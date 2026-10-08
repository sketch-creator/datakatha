// The desk, step by step. Each step is logged to the side panel with its skill,
// prompt, raw answer, timing and (for drafts) the fact-check result.
import { analyze, Panel, type Codebook, type Dataset, type Roles, type Story } from '@/engine'
import { angleStory, type AngleQuery } from '@/engine/angle'
import { parity, runGate, type GateResult } from '@/engine/gate'
import { addStep, getState, setState, updateStep, updateStory, type Intake, type Lang, type Pick } from '@/state/store'
import { generate, parseJson, pickModel, listModels, settings, withTimeout } from './client'
import { normalize, pieces, type StoryContent } from './content'
import {
  ANGLE_SYSTEM,
  FINDER_SYSTEM,
  INTAKE_SYSTEM,
  WRITER_EN_SYSTEM,
  WRITER_ML_SYSTEM,
  angleUser,
  finderUser,
  fixUser,
  intakeUser,
  writerUser,
} from './prompts'
import { hasRecording, loadRecording, recorded, remember } from './replay'

/** With a recording available, a live call slower than this is cancelled and the recording used (plan: 25 s). */
const SLOW_MS = 25_000
let modelCache = ''

export async function currentModel(): Promise<string> {
  if (settings.model) return settings.model
  if (modelCache) return modelCache
  try {
    modelCache = pickModel(await listModels())
  } catch {
    modelCache = 'gemini-flash-latest'
  }
  return modelCache
}

export function resetModelCache() {
  modelCache = ''
}

/** One model call, logged. Uses the recording in replay mode, or when live is failing or slow. */
async function ask(key: string, skill: string, title: string, system: string, user: string, storyId?: string) {
  const step = addStep({ skill, title, status: 'running', system, user, storyId })
  const rec = recorded(key)
  const useReplay = settings.mode === 'replay'
  if (useReplay) {
    if (!rec) {
      updateStep(step, { status: 'error', note: 'The sample run only covers the CO₂ sample. Add a free Gemini key in Settings to use your own file.' })
      throw new Error('To find stories in your own file, add a free Gemini key in Settings. The CO₂ sample works without one.')
    }
    await new Promise((r) => setTimeout(r, Math.min(rec.ms, 3000) * 0.6 + Math.random() * 400))
    updateStep(step, { status: 'done', source: 'replay', model: rec.model, ms: rec.ms, response: rec.text, note: 'Sample run: answer prepared in advance. The number checks still run live.' })
    return { text: rec.text, step }
  }
  const model = await currentModel()
  updateStep(step, { model })
  const call = (signal?: AbortSignal) => generate({ model, system, user, signal }, (msg) => updateStep(step, { note: msg }))
  try {
    const res = rec ? await withTimeout(call, SLOW_MS) : await call()
    if (res === null) {
      updateStep(step, { status: 'done', source: 'replay', model: rec!.model, ms: SLOW_MS, response: rec!.text, note: 'Live call was slow; used the recording.' })
      return { text: rec!.text, step }
    }
    remember(key, res.text, res.model, res.ms)
    updateStep(step, { status: 'done', source: 'live', ms: res.ms, response: res.text, note: res.tokens?.output ? `${res.tokens.input} in / ${res.tokens.output} out tokens` : undefined })
    return { text: res.text, step }
  } catch (e) {
    if (rec) {
      updateStep(step, { status: 'done', source: 'replay', model: rec.model, ms: rec.ms, response: rec.text, note: `Live call failed (${(e as Error).message}); used the recording.` })
      return { text: rec.text, step }
    }
    updateStep(step, { status: 'error', note: (e as Error).message })
    throw e
  }
}

// ---------------- 1. engine + intake ----------------

export async function startAnalysis(ds: Dataset, cb: Codebook, source: string, overrides: Partial<Roles> = {}) {
  setState({ steps: [], stories: {}, pick: undefined, intake: undefined, selected: undefined, error: undefined })
  await loadRecording(ds.name)
  if (!hasRecording() && settings.mode === 'replay' && (settings.key || settings.passcode)) settings.mode = settings.passcode ? 'server' : 'own'
  const t0 = performance.now()
  const step = addStep({ skill: 'engine', title: 'Profile the file and run every check', status: 'running', source: 'engine' })
  const analysis = analyze(ds, cb, overrides, source)
  const panel = new Panel(ds, analysis.roles.entity, analysis.roles.time, analysis.roles.exclude)
  updateStep(step, {
    status: 'done',
    ms: Math.round(performance.now() - t0),
    response: [
      `Data card: ${analysis.card.rows.toLocaleString('en-US')} rows, ${analysis.card.entities} ${analysis.roles.entity} values, ${analysis.card.periods.first}-${analysis.card.periods.last}`,
      '',
      'Checks run:',
      ...analysis.checksRun.map((c) => `- ${c.name}: ${c.result}`),
      '',
      `${analysis.stories.length} candidate stories, ${analysis.stories.reduce((a, s) => a + s.facts.length, 0)} facts computed.`,
    ].join('\n'),
    note: 'Code, not the model: profile.py, find_angles.py and the hidden checks, in the browser.',
  })
  setState({ dataset: ds, codebook: cb, source, analysis, panel, phase: 'board' })
  // One click does the rest: understand the data, then pick and write the stories.
  await runIntake()
  await findStories()
}

export async function runIntake() {
  const { analysis, dataset } = getState()
  if (!analysis || !dataset) return
  setState({ intakeBusy: true })
  try {
    const sample = dataset.rows.slice(0, 4)
    const { text } = await ask('intake', 'data-intake', 'Read the data card', INTAKE_SYSTEM, intakeUser(analysis, sample))
    const j = parseJson<Intake>(text)
    setState({ intake: { summary: j.summary ?? '', roles_ok: j.roles_ok !== false, role_notes: j.role_notes, warnings: j.warnings ?? [], questions: j.questions ?? [] } })
  } catch (e) {
    setState({ error: (e as Error).message })
  } finally {
    setState({ intakeBusy: false })
  }
}

// ---------------- 2. story finder ----------------

export async function findStories() {
  const { analysis, angle } = getState()
  if (!analysis) return
  setState({ phase: 'board', pickBusy: true, error: undefined })
  try {
    const { text } = await ask('finder', 'story-finder', 'Choose the stories', FINDER_SYSTEM, finderUser(analysis, angle))
    const j = parseJson<Pick>(text)
    const ids = new Set(analysis.stories.map((s) => s.id))
    const hiddenIds = new Set(analysis.stories.filter((s) => s.hidden).map((s) => s.id))
    const top = (j.top ?? []).filter((x) => ids.has(x.id) && !hiddenIds.has(x.id)).slice(0, 3)
    const hidden = (j.hidden ?? []).filter((x) => hiddenIds.has(x.id)).slice(0, 3)
    // Fill gaps from the engine's own ranking so the board always has 3 + 3.
    for (const s of analysis.stories) {
      if (top.length < 3 && !s.hidden && !top.some((t) => t.id === s.id)) top.push({ id: s.id, headline: s.title, why: 'Engine ranking' })
      if (hidden.length < 3 && s.hidden && !hidden.some((t) => t.id === s.id)) hidden.push({ id: s.id, headline: s.title, why: 'Engine ranking', why_missed: s.whyMissed })
    }
    setState({ pick: { top, hidden, dropped: j.dropped ?? [], note: j.note }, selected: top[0]?.id })
    await Promise.all(top.map((t, i) => new Promise((r) => setTimeout(r, i * 1200)).then(() => writeStory(t.id))))
  } catch (e) {
    setState({ error: (e as Error).message })
  } finally {
    setState({ pickBusy: false })
  }
}

// ---------------- 3. writers + gate + one automatic fix ----------------

export function storyById(id: string): Story | undefined {
  return getState().analysis?.stories.find((s) => s.id === id)
}

const storyKey = (s: Story) => `${s.kind}:${s.entities[0] ?? ''}`.replace(/\s+/g, '_')

function gate(s: Story, c: StoryContent, lang: Lang): GateResult {
  const { analysis, panel } = getState()
  return runGate({
    lang,
    pieces: pieces(c),
    facts: [...s.facts, ...(analysis?.context ?? [])],
    assertions: s.assertions,
    panel,
    roles: analysis?.roles,
    glossary: c.glossary,
    perPerson: s.perPerson,
  })
}

async function writeLang(s: Story, lang: Lang, english?: StoryContent): Promise<{ content: StoryContent; gate: GateResult; fixed: boolean }> {
  const { analysis } = getState()
  const key = storyKey(s)
  const system = lang === 'en' ? WRITER_EN_SYSTEM : WRITER_ML_SYSTEM
  const user = writerUser(analysis!, s, lang, english && { headline: english.headline, dek: english.dek, body: english.body, slides: english.slides })
  const label = lang === 'en' ? 'English' : 'Malayalam'
  const { text, step } = await ask(`write:${lang}:${key}`, lang === 'en' ? 'writer' : 'writer-ml', `Write ${label}: ${s.title}`, system, user, s.id)
  let content = normalize(parseJson(text))
  let g = gate(s, content, lang)
  updateStep(step, { gate: g })
  const gateStep = addStep({ skill: 'fact-check-gate', title: `Fact-check ${label}: ${g.verdict} (${g.passed} passed, ${g.failed} failed)`, status: 'done', source: 'engine', gate: g, storyId: s.id })
  void gateStep
  let fixed = false
  if (g.verdict === 'FAIL') {
    const failures = g.items.filter((i) => i.status === 'fail').map((i) => ({ where: i.where, claim: i.claim, detail: i.detail, fix: i.fix }))
    const fixUserMsg = JSON.stringify({ ...JSON.parse(user), fix: JSON.parse(fixUser(normalizeForPrompt(content), failures)) }, null, 1)
    const r = await ask(`fix:${lang}:${key}`, lang === 'en' ? 'writer' : 'writer-ml', `Fix ${label} (${failures.length} failed check${failures.length > 1 ? 's' : ''})`, system, fixUserMsg, s.id)
    const second = normalize(parseJson(r.text))
    const g2 = gate(s, second, lang)
    updateStep(r.step, { gate: g2 })
    addStep({ skill: 'fact-check-gate', title: `Re-check ${label}: ${g2.verdict} (${g2.passed} passed, ${g2.failed} failed)`, status: 'done', source: 'engine', gate: g2, storyId: s.id })
    if (g2.failed <= g.failed) {
      content = second
      g = g2
      fixed = true
    }
  }
  return { content, gate: g, fixed }
}

function normalizeForPrompt(c: StoryContent) {
  const { glossary, ...rest } = c
  return glossary ? { ...rest, glossary } : rest
}

export async function writeStory(id: string) {
  const s = storyById(id)
  if (!s) return
  const cur = getState().stories[id]
  if (cur && (cur.status === 'writing' || cur.status === 'done')) return
  updateStory(id, { status: 'writing', phase: 'Writing English', error: undefined })
  try {
    const en = await writeLang(s, 'en')
    updateStory(id, { en: en.content, gateEn: en.gate, fixedEn: en.fixed, phase: 'Writing Malayalam' })
    const ml = await writeLang(s, 'ml', en.content)
    updateStory(id, { ml: ml.content, gateMl: ml.gate, fixedMl: ml.fixed, parity: parity(en.gate, ml.gate, s.facts), status: 'done', phase: undefined })
  } catch (e) {
    updateStory(id, { status: 'error', error: (e as Error).message, phase: undefined })
  }
}

/** Re-run the gate on content edited by hand. */
export function regate(id: string, lang: Lang, content: StoryContent) {
  const s = storyById(id)
  if (!s) return
  const g = gate(s, content, lang)
  updateStory(id, lang === 'en' ? { en: content, gateEn: g } : { ml: content, gateMl: g })
}

// ---------------- 4. the reporter's own angle ----------------

export async function tryOwnAngle(text: string) {
  const { analysis, panel } = getState()
  if (!analysis || !panel || !text.trim()) return
  setState({ busy: 'Testing your angle against the data...', error: undefined })
  try {
    const names = panel.entities
    const { text: answer } = await ask(`angle:${text.trim().toLowerCase().slice(0, 80)}`, 'data-explorer', `Turn the angle into a query: "${text.trim()}"`, ANGLE_SYSTEM, angleUser(analysis, text, names))
    const q = parseJson<AngleQuery>(answer)
    if (!q.feasible) {
      setState({ error: `The data can't test that directly: ${q.reason ?? ''}` })
      return
    }
    const id = `A${analysis.stories.filter((s) => s.kind === 'own-angle').length + 1}`
    const story = angleStory(analysis, panel, q, id)
    if (!story) {
      setState({ error: 'None of the places in that angle are in this file.' })
      return
    }
    const failed = story.assertions.filter((a) => !a.holds)
    addStep({
      skill: 'engine',
      title: `Computed ${story.facts.length} facts for your angle`,
      status: 'done',
      source: 'engine',
      response: [`Query: ${JSON.stringify(q)}`, '', ...story.facts.map((f) => `${f.id} ${f.label}: ${f.en}`), '', ...story.assertions.map((a) => `${a.holds ? 'holds' : 'DOES NOT HOLD'}: ${a.text} (${a.detail})`)].join('\n'),
      note: failed.length ? `${failed.length} part(s) of the angle are not supported by the data.` : 'Supported by the data.',
    })
    setState((st) => ({ analysis: { ...st.analysis!, stories: [...st.analysis!.stories, story] }, selected: id }))
    await writeStory(id)
  } catch (e) {
    setState({ error: (e as Error).message })
  } finally {
    setState({ busy: undefined })
  }
}
