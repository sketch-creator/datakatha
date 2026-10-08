// Tiny global store (useSyncExternalStore). The pipeline writes, components read.
import { useSyncExternalStore } from 'react'
import type { Analysis, Codebook, Dataset, Panel } from '@/engine'
import type { GateItem, GateResult } from '@/engine/gate'
import type { StoryContent } from '@/llm/content'

export type Lang = 'en' | 'ml'
export type ViewLang = 'en' | 'ml' | 'both'
export type Format = 'article' | 'carousel'

export interface Step {
  id: string
  skill: string
  title: string
  status: 'running' | 'done' | 'error' | 'skipped'
  source?: 'live' | 'replay' | 'engine'
  model?: string
  ms?: number
  system?: string
  user?: string
  response?: string
  gate?: GateResult
  note?: string
  storyId?: string
}

export interface StoryRun {
  status: 'idle' | 'writing' | 'done' | 'error'
  phase?: string
  en?: StoryContent
  ml?: StoryContent
  gateEn?: GateResult
  gateMl?: GateResult
  parity?: GateItem[]
  fixedEn?: boolean
  fixedMl?: boolean
  error?: string
}

export interface Intake {
  summary: string
  roles_ok: boolean
  role_notes?: string
  warnings: { flag: string; plain: string }[]
  questions: string[]
}

export interface Pick {
  top: { id: string; headline: string; why: string }[]
  hidden: { id: string; headline: string; why: string; why_missed?: string }[]
  dropped: { id: string; reason: string }[]
  note?: string
}

export interface State {
  phase: 'upload' | 'board' | 'studio'
  dataset?: Dataset
  codebook?: Codebook
  source: string
  angle: string
  formatPref: Format | 'later'
  analysis?: Analysis
  panel?: Panel
  intake?: Intake
  intakeBusy?: boolean
  pick?: Pick
  pickBusy?: boolean
  stories: Record<string, StoryRun>
  steps: Step[]
  selected?: string
  view: { format: Format; template: string; theme: string; accent: string; lang: ViewLang }
  error?: string
  busy?: string
}

const initial: State = {
  phase: 'upload',
  source: '',
  angle: '',
  formatPref: 'later',
  stories: {},
  steps: [],
  view: { format: 'article', template: 'broadsheet', theme: 'house', accent: '', lang: 'en' },
}

let state: State = initial
const listeners = new Set<() => void>()

export function getState() {
  return state
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...p }
  listeners.forEach((l) => l())
}

export function resetState() {
  state = { ...initial, view: state.view }
  listeners.forEach((l) => l())
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => sel(state),
  )
}

export function updateStory(id: string, patch: Partial<StoryRun>) {
  setState((s) => ({ stories: { ...s.stories, [id]: { ...(s.stories[id] ?? { status: 'idle' }), ...patch } } }))
}

let stepSeq = 0
export function addStep(step: Omit<Step, 'id'>): string {
  const id = `step${++stepSeq}`
  setState((s) => ({ steps: [...s.steps, { ...step, id }] }))
  return id
}

export function updateStep(id: string, patch: Partial<Step>) {
  setState((s) => ({ steps: s.steps.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
}
