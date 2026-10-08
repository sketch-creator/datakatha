// Server-side Gemini proxy (Vercel function). Lets the demo use the owner's key,
// kept in the GEMINI_API_KEY environment variable, behind DEMO_PASSCODE.
// Visitors without the passcode use their own key directly from the browser instead.
// It only relays the app's own request shape, caps the body and rate-limits each address,
// so a shared passcode does not turn the owner's key into an open relay.
import { timingSafeEqual } from 'node:crypto'

const GOOGLE = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL_RE = /^[a-z0-9][a-z0-9.\-]{2,80}$/
export const MAX_BODY = 256 * 1024
export const RATE_LIMIT = 60
export const RATE_WINDOW_MS = 10 * 60 * 1000

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

function passcodeOk(given: unknown): boolean {
  const want = process.env.DEMO_PASSCODE ?? ''
  if (!want) return false
  const a = Buffer.from(String(given ?? ''))
  const b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Calls per address in the last window. In memory: on Vercel this counts per warm
// instance, not globally, so it slows abuse down rather than capping it exactly.
const hits = new Map<string, number[]>()

function rateLimited(addr: string, now = Date.now()): boolean {
  const recent = (hits.get(addr) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) {
    hits.set(addr, recent)
    return true
  }
  recent.push(now)
  hits.set(addr, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k)
  return false
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const onlyKeys = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every((k) => keys.includes(k))

function onePart(v: unknown): string | null {
  if (!isObj(v) || !Array.isArray(v.parts) || v.parts.length !== 1) return null
  const p = v.parts[0]
  return isObj(p) && onlyKeys(p, ['text']) && typeof p.text === 'string' ? p.text : null
}

/** Rebuild the app's generateContent request (system text, one user turn, temperature, JSON); null if it is anything else. */
export function cleanPayload(p: unknown): object | null {
  if (!isObj(p) || !onlyKeys(p, ['systemInstruction', 'contents', 'generationConfig'])) return null
  const system = onePart(p.systemInstruction)
  if (system === null || !onlyKeys(p.systemInstruction as Record<string, unknown>, ['parts'])) return null
  if (!Array.isArray(p.contents) || p.contents.length !== 1) return null
  const turn = p.contents[0]
  if (!isObj(turn) || turn.role !== 'user' || !onlyKeys(turn, ['role', 'parts'])) return null
  const user = onePart(turn)
  if (user === null) return null
  const g = p.generationConfig
  if (!isObj(g) || !onlyKeys(g, ['temperature', 'responseMimeType'])) return null
  if (g.responseMimeType !== 'application/json') return null
  const temperature = g.temperature ?? 0.4
  if (typeof temperature !== 'number' || !(temperature >= 0 && temperature <= 1)) return null
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature, responseMimeType: 'application/json' },
  }
}

function clientAddr(request: Request): string {
  return (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
}

/** Shared by the Vercel function and the local dev server. `local` skips the passcode and the rate limit. */
export async function handle(request: Request, local = false): Promise<Response> {
  const key = process.env.GEMINI_API_KEY ?? ''
  if (request.method === 'GET') {
    return json(200, { serverKey: Boolean(key), passcodeRequired: !local })
  }
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })
  if (!key) return json(503, { error: 'No server key is configured. Use your own Gemini key in Settings.' })
  if (!local && rateLimited(clientAddr(request))) return json(429, { error: 'Too many requests. Wait a few minutes and try again.' })

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return json(413, { error: 'Request too large' })
  const raw = await request.text()
  if (Buffer.byteLength(raw) > MAX_BODY) return json(413, { error: 'Request too large' })
  let body: { passcode?: string; op?: string; model?: string; payload?: unknown }
  try {
    body = JSON.parse(raw) as typeof body
  } catch {
    return json(400, { error: 'Bad JSON' })
  }
  if (!isObj(body)) return json(400, { error: 'Bad JSON' })
  if (!local && !passcodeOk(body.passcode)) {
    await new Promise((r) => setTimeout(r, 600))
    return json(401, { error: 'Wrong passcode' })
  }

  const headers = { 'content-type': 'application/json', 'x-goog-api-key': key }
  let upstream: Response
  if (body.op === 'models') {
    upstream = await fetch(`${GOOGLE}/models?pageSize=200`, { headers })
  } else if (body.op === 'check') {
    return json(200, { ok: true })
  } else if (body.op === 'generate') {
    if (!body.model || !MODEL_RE.test(body.model)) return json(400, { error: 'Bad model name' })
    const payload = cleanPayload(body.payload)
    if (!payload) return json(400, { error: 'This proxy only accepts the app’s own requests.' })
    upstream = await fetch(`${GOOGLE}/models/${body.model}:generateContent`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  } else {
    return json(400, { error: 'Unknown operation' })
  }
  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export function GET(request: Request) {
  return handle(request)
}

export function POST(request: Request) {
  return handle(request)
}
