// The desk's work as six plain stages, for the reading screen and the side panel.
import { useStore, type State, type Step } from './store'

export type Who = 'code' | 'ai'
export type Status = 'waiting' | 'working' | 'done' | 'error'

export interface Stage {
  id: string
  who: Who
  title: string
  plain: string
  stat?: string
  status: Status
  steps: Step[]
}

function statusOf(steps: Step[], started: boolean): Status {
  if (steps.some((s) => s.status === 'running')) return 'working'
  if (steps.some((s) => s.status === 'error')) return 'error'
  if (steps.length) return 'done'
  return started ? 'working' : 'waiting'
}

export function stagesOf(s: State): Stage[] {
  const by = (...skills: string[]) => s.steps.filter((x) => skills.includes(x.skill))
  const engine = s.steps.filter((x) => x.skill === 'engine')
  const a = s.analysis
  const c = a?.card
  const runs = Object.values(s.stories)
  const done = runs.filter((r) => r.status === 'done').length
  const writing = runs.filter((r) => r.status === 'writing').length
  const gates = runs.flatMap((r) => [r.gateEn, r.gateMl]).filter(Boolean)
  const checked = gates.reduce((n, g) => n + g!.passed + g!.failed, 0)
  const wrong = gates.reduce((n, g) => n + g!.failed, 0)
  const fixes = runs.reduce((n, r) => n + Number(!!r.fixedEn) + Number(!!r.fixedMl), 0)
  const writers = by('writer', 'writer-ml')
  const checks = by('fact-check-gate')
  const sample = s.steps.some((x) => x.source === 'replay')
  return [
    {
      id: 'read',
      who: 'code',
      title: 'Read the file',
      plain: 'Counted every row and noted anything odd.',
      stat: c ? `${c.rows.toLocaleString('en-US')} rows · ${c.entities} ${a!.roles.entity === 'country' ? 'countries' : a!.roles.entity} · ${c.periods.count} years` : undefined,
      status: statusOf(engine, false),
      steps: engine,
    },
    {
      id: 'understand',
      who: 'ai',
      title: 'Explain what the data is',
      plain: 'Wrote a short, plain summary and the things to watch out for.',
      status: statusOf(by('data-intake'), false),
      steps: by('data-intake'),
    },
    {
      id: 'look',
      who: 'code',
      title: 'Look for stories',
      plain: 'Compared countries, years, totals and per-person figures. Every number is worked out here.',
      stat: a ? `${a.checksRun.length} checks → ${a.stories.filter((x) => x.kind !== 'own-angle').length} possible stories` : undefined,
      status: statusOf(engine, false),
      steps: engine,
    },
    {
      id: 'pick',
      who: 'ai',
      title: 'Pick the best ones',
      plain: 'Chose 3 stories to write now and 3 hidden ones to offer, and said why.',
      stat: s.pick ? `${s.pick.top.length} to write + ${s.pick.hidden.length} hidden` : undefined,
      status: statusOf(by('story-finder', 'data-explorer'), false),
      steps: by('story-finder', 'data-explorer'),
    },
    {
      id: 'write',
      who: 'ai',
      title: 'Write them',
      plain: 'Wrote each story in English and in Malayalam, using only the worked-out numbers.',
      stat: runs.length ? `${done} written${writing ? `, ${writing} in progress` : ''} · English + മലയാളം` : undefined,
      status: writing ? 'working' : statusOf(writers, false),
      steps: writers,
    },
    {
      id: 'check',
      who: 'code',
      title: 'Check every number',
      plain: 'Re-did the maths for every number and comparison in the writing. A wrong one goes back to be fixed.',
      stat: checked ? `${checked} numbers checked · ${wrong} wrong${fixes ? ` · ${fixes} caught and fixed` : ''}` : undefined,
      status: writing && !checks.length ? 'waiting' : statusOf(checks, false),
      steps: checks,
    },
  ].map((x) => ({ ...x, plain: x.id === 'write' && sample ? `${x.plain} (Sample run: the writing was prepared in advance.)` : x.plain })) as Stage[]
}

export function useStages(): Stage[] {
  const steps = useStore((s) => s.steps)
  const stories = useStore((s) => s.stories)
  const pick = useStore((s) => s.pick)
  const analysis = useStore((s) => s.analysis)
  return stagesOf({ steps, stories, pick, analysis } as State)
}
