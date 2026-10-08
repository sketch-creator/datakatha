// Recorded Gemini answers for the bundled sample, so the demo works with no key,
// no network, or a slow API. Every replayed step is labelled "replay" in the side panel.

export type Recording = Record<string, { text: string; model: string; ms: number; recordedAt: string }>

let loaded: Recording | null = null
let loadedFor = ''
const live: Recording = {}

export async function loadRecording(dataset: string): Promise<Recording | null> {
  if (loadedFor === dataset) return loaded
  loadedFor = dataset
  loaded = null
  try {
    const r = await fetch(`/replay/${encodeURIComponent(dataset.replace(/\.[^.]+$/, ''))}.json`, { cache: 'no-store' })
    if (r.ok) loaded = (await r.json()) as Recording
  } catch {
    /* no recording for this file */
  }
  return loaded
}

export function recorded(key: string) {
  return loaded?.[key] ?? null
}

export function hasRecording() {
  return Boolean(loaded && Object.keys(loaded).length)
}

/** Keep live answers so a good run can be saved as the new recording (dev server only). */
export function remember(key: string, text: string, model: string, ms: number) {
  live[key] = { text, model, ms, recordedAt: new Date().toISOString() }
}

export async function saveRecording(dataset: string): Promise<string> {
  const r = await fetch('/api/replay-save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: dataset.replace(/\.[^.]+$/, ''), data: { ...(loaded ?? {}), ...live } }),
  })
  if (!r.ok) throw new Error(`Save failed (${r.status}). Recording only works under npm run dev.`)
  loaded = { ...(loaded ?? {}), ...live }
  return `${Object.keys(loaded).length} answers saved`
}

export function liveCount() {
  return Object.keys(live).length
}
