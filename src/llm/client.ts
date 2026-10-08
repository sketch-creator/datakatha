// Gemini over REST. Two routes to the same API:
//  - own key: the browser calls Google directly with the visitor's key (kept in this browser);
//  - server: the browser calls /api/gemini with the demo passcode; the owner's key stays on Vercel.

const GOOGLE = 'https://generativelanguage.googleapis.com/v1beta'
const LS_KEY = 'dss.gemini.key'
const LS_PASS = 'dss.demo.passcode'
const LS_MODE = 'dss.gemini.mode'
const LS_MODEL = 'dss.gemini.model'

export type Mode = 'own' | 'server' | 'replay'

function ls(k: string): string {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}
function lsSet(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* storage blocked: settings last for this tab only */
  }
}

const memory: Record<string, string> = {}

export const settings = {
  get key() {
    return memory.key ?? ls(LS_KEY)
  },
  set key(v: string) {
    memory.key = v
    lsSet(LS_KEY, v || null)
  },
  get passcode() {
    return memory.pass ?? ls(LS_PASS)
  },
  set passcode(v: string) {
    memory.pass = v
    lsSet(LS_PASS, v || null)
  },
  get mode(): Mode {
    return ((memory.mode ?? ls(LS_MODE)) as Mode) || 'replay'
  },
  set mode(v: Mode) {
    memory.mode = v
    lsSet(LS_MODE, v)
  },
  get model() {
    return memory.model ?? ls(LS_MODEL)
  },
  set model(v: string) {
    memory.model = v
    lsSet(LS_MODEL, v || null)
  },
}

export class LlmError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

export async function serverStatus(): Promise<{ serverKey: boolean; passcodeRequired: boolean }> {
  try {
    const r = await fetch('/api/gemini', { method: 'GET' })
    if (!r.ok) return { serverKey: false, passcodeRequired: true }
    return await r.json()
  } catch {
    return { serverKey: false, passcodeRequired: true }
  }
}

/** How to reach Gemini. Defaults to the saved settings; Settings passes unsaved values to test them. */
export interface Connection {
  mode: Mode
  key: string
  passcode: string
}

const saved = (): Connection => ({ mode: settings.mode, key: settings.key, passcode: settings.passcode })

async function call(op: 'models' | 'generate', model: string, payload: unknown, signal?: AbortSignal, conn: Connection = saved()): Promise<unknown> {
  let r: Response
  if (conn.mode === 'server') {
    r = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op, model, payload, passcode: conn.passcode }),
      signal,
    })
  } else {
    const key = conn.key
    if (!key) throw new LlmError('No Gemini key. Add one in Settings.', 401)
    const headers = { 'content-type': 'application/json', 'x-goog-api-key': key }
    r =
      op === 'models'
        ? await fetch(`${GOOGLE}/models?pageSize=200`, { headers, signal })
        : await fetch(`${GOOGLE}/models/${model}:generateContent`, { method: 'POST', headers, body: JSON.stringify(payload), signal })
  }
  const text = await r.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    /* keep raw text */
  }
  if (!r.ok) {
    const msg = (body as { error?: { message?: string } | string })?.error
    const m = typeof msg === 'string' ? msg : msg?.message
    throw new LlmError(friendly(r.status, m ?? text.slice(0, 200)), r.status)
  }
  return body
}

function friendly(status: number, msg: string): string {
  if (status === 401 && /passcode/i.test(msg)) return 'Wrong demo passcode.'
  if (status === 400 && /API key not valid/i.test(msg)) return 'Google rejected this key. Check it in Settings.'
  if (status === 403) return 'This key is not allowed to use the Gemini API (403).'
  if (status === 429) return 'Gemini rate limit reached. Waiting and retrying...'
  if (status === 503) return 'Gemini is overloaded right now (503).'
  return `Gemini error ${status}: ${msg}`
}

export interface ModelInfo {
  name: string
  displayName: string
}

export async function listModels(conn?: Connection): Promise<ModelInfo[]> {
  const body = (await call('models', '', null, undefined, conn)) as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] }
  return (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({ name: m.name.replace(/^models\//, ''), displayName: m.displayName ?? m.name }))
}

/** Rank text models: newest flash first (fast, free tier), then pro; skip lite, image, audio, tts, embedding. */
export function pickModel(models: ModelInfo[]): string {
  const score = (n: string) => {
    if (!/^gemini-/.test(n) || /(lite|image|audio|tts|embed|live|thinking|exp|learnlm|robotics|computer|nano)/.test(n)) return -1
    const v = parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0')
    const tier = /flash/.test(n) ? 2 : /pro/.test(n) ? 1 : 0
    const stable = /preview/.test(n) ? 0 : 0.5
    return v * 10 + tier + stable
  }
  const ranked = models.map((m) => m.name).filter((n) => score(n) >= 0).sort((a, b) => score(b) - score(a))
  return ranked[0] ?? 'gemini-flash-latest'
}

export interface GenRequest {
  model: string
  system: string
  user: string
  temperature?: number
  signal?: AbortSignal
}

export interface GenResult {
  text: string
  model: string
  ms: number
  tokens?: { input?: number; output?: number }
}

export async function generate(req: GenRequest, onRetry?: (msg: string) => void): Promise<GenResult> {
  const payload = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: 'user', parts: [{ text: req.user }] }],
    generationConfig: { temperature: req.temperature ?? 0.4, responseMimeType: 'application/json' },
  }
  const t0 = performance.now()
  for (let attempt = 0; ; attempt++) {
    try {
      const body = (await call('generate', req.model, payload, req.signal)) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
        promptFeedback?: { blockReason?: string }
      }
      const parts = body.candidates?.[0]?.content?.parts ?? []
      const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('')
      if (!text) throw new LlmError(`Empty answer from Gemini (${body.promptFeedback?.blockReason ?? body.candidates?.[0]?.finishReason ?? 'no text'}).`)
      return {
        text,
        model: req.model,
        ms: Math.round(performance.now() - t0),
        tokens: { input: body.usageMetadata?.promptTokenCount, output: body.usageMetadata?.candidatesTokenCount },
      }
    } catch (e) {
      const status = e instanceof LlmError ? e.status : 0
      if (req.signal?.aborted) throw e
      if (attempt < 3 && (status === 429 || status === 503 || status === 500)) {
        const wait = (attempt + 1) * 8000
        onRetry?.(`${(e as Error).message} (retry in ${wait / 1000}s)`)
        await new Promise((r) => setTimeout(r, wait))
        continue
      }
      throw e
    }
  }
}

/**
 * Run a live call for at most `ms`. On timeout the call is aborted (no more quota spent,
 * no stray rejection) and null is returned so the caller can use the recording.
 */
export async function withTimeout<T>(start: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T | null> {
  const ctl = new AbortController()
  const live = start(ctl.signal)
  let timer: ReturnType<typeof setTimeout> | undefined
  const slow = new Promise<null>((r) => {
    timer = setTimeout(() => r(null), ms)
  })
  try {
    const res = await Promise.race([live, slow])
    if (res === null) {
      live.catch(() => {})
      ctl.abort()
    }
    return res
  } finally {
    clearTimeout(timer)
  }
}

/** Parse a JSON answer, tolerating code fences or text around the object. */
export function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    const s = text.indexOf('{')
    const e = text.lastIndexOf('}')
    if (s !== -1 && e > s) return JSON.parse(text.slice(s, e + 1)) as T
    throw new LlmError('Gemini did not return valid JSON.')
  }
}
