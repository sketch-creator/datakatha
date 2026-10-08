import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, EyeOff, Lightbulb, Loader2, PenLine, Search, Sparkles, Wand2 } from 'lucide-react'
import type { Story } from '@/engine'
import { storyById, tryOwnAngle, writeStory } from '@/llm/pipeline'
import { setState, useStore } from '@/state/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Chart } from '@/components/Chart'
import { GateBadge } from '@/components/GateBadge'
import { ArticleView } from '@/components/StoryPreview'
import { getTheme } from '@/templates/themes'
import { useStages } from '@/state/stages'
import { AboutData } from './AboutData'
import { cn } from '@/lib/utils'

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const KIND: Record<string, string> = {
  crossover: 'Crossover',
  leaders: 'Concentration',
  rise: 'Biggest rise',
  fall: 'Biggest fall',
  absolute: 'Absolute change',
  outliers: 'Outliers',
  'per-person-gap': 'Per-person gap',
  peaked: 'Past the peak',
  turns: 'Turn this year',
  imports: 'Counting imports',
  decoupling: 'Decoupling',
  climbers: 'Rank climbers',
  'records-vs-peaks': 'Two camps',
  'total-vs-per-person': 'Total vs per person',
  'quiet-risers': 'Quiet risers',
  'own-angle': 'Your angle',
}

export function Board() {
  const pick = useStore((s) => s.pick)
  const analysis = useStore((s) => s.analysis)!
  const stories = useStore((s) => s.stories)
  const selected = useStore((s) => s.selected)
  const busy = useStore((s) => s.busy)
  const [angle, setAngle] = useState('')

  const ownIds = analysis.stories.filter((s) => s.kind === 'own-angle').map((s) => s.id)
  const writtenLeads = (pick?.hidden ?? []).filter((h) => stories[h.id] && stories[h.id].status !== 'idle').map((h) => h.id)
  const tabs = [...(pick?.top.map((t) => t.id) ?? []), ...writtenLeads, ...ownIds]
  const current = selected && tabs.includes(selected) ? selected : tabs[0]

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-6">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Step 2 of 3 · {analysis.card.file}</div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">The stories in your data</h1>
        </div>
        {pick?.note && (
          <div className="ml-auto max-w-xl rounded-lg border bg-card/60 px-3 py-2 text-sm">
            <Lightbulb className="mr-1.5 inline size-4 text-warn" />
            {pick.note}
          </div>
        )}
      </div>
      <AboutData />

      {!pick ? (
        <Reading />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
          {/* Written */}
          <section className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <PenLine className="size-4 text-ok" />
              <h2 className="text-lg font-semibold">Top stories, written for you</h2>
              <Badge variant="ok">{tabs.filter((t) => stories[t]?.status === 'done').length} of {tabs.length} ready · English + മലയാളം · every number checked</Badge>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {tabs.map((id, i) => {
                const s = storyById(id)
                const run = stories[id]
                const head = pick?.top.find((t) => t.id === id)?.headline ?? pick?.hidden.find((t) => t.id === id)?.headline ?? s?.title
                return (
                  <button
                    key={id}
                    onClick={() => setState({ selected: id })}
                    className={cn('flex max-w-[300px] items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors cursor-pointer', current === id ? 'border-brand bg-brand/10' : 'bg-card/40 hover:bg-accent/50')}
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/20 text-[11px] font-semibold text-brand tabular-nums">#{i + 1}</span>
                    <span className="truncate">{head}</span>
                    {run?.status === 'writing' ? <Loader2 className="size-3.5 shrink-0 animate-spin text-brand" /> : run?.status === 'done' ? <span className={cn('size-2 shrink-0 rounded-full', run.gateEn?.verdict === 'PASS' && run.gateMl?.verdict === 'PASS' ? 'bg-ok' : 'bg-destructive')} /> : null}
                    {s?.hidden && <Badge variant="brand" className="h-4 px-1 text-[10px]">lead</Badge>}
                    {s?.kind === 'own-angle' && <Badge variant="warn" className="h-4 px-1 text-[10px]">yours</Badge>}
                  </button>
                )
              })}
            </div>
            {current && <WrittenStory id={current} why={pick?.top.find((t) => t.id === current)?.why ?? pick?.hidden.find((t) => t.id === current)?.why} />}
          </section>

          {/* Leads */}
          <section className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <EyeOff className="size-4 text-brand" />
              <h2 className="text-lg font-semibold">3 more stories hiding in the data</h2>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              <b className="text-foreground">Not written yet.</b> Most people would miss these. Click one and it gets written and checked like the others.
            </p>
            <div className="space-y-3">
              {pick?.hidden.map((h) => <LeadCard key={h.id} id={h.id} headline={h.headline} why={h.why_missed ?? h.why} />)}
            </div>
            <div className="mt-6 rounded-xl border bg-card/40 p-4">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <Search className="size-4" /> None of these? Try your own angle
              </div>
              <p className="mb-2 text-sm text-muted-foreground">The desk turns it into a query, computes the numbers, and tells you which parts the data supports.</p>
              <Textarea placeholder="e.g. India emits less per person than Indonesia" value={angle} onChange={(e) => setAngle(e.target.value)} />
              <Button className="mt-2 w-full" variant="secondary" disabled={!angle.trim() || !!busy} onClick={() => void tryOwnAngle(angle)}>
                {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} {busy ?? 'Test and write it'}
              </Button>
            </div>
            {pick?.dropped?.length ? (
              <details className="mt-4 text-sm text-muted-foreground">
                <summary className="cursor-pointer">Angles the story finder dropped ({pick.dropped.length})</summary>
                <ul className="mt-2 space-y-1.5">
                  {pick.dropped.map((d) => (
                    <li key={d.id}>
                      <b className="text-foreground">{storyById(d.id)?.title ?? d.id}</b>: {d.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        </div>
      )}
    </div>
  )
}

function WrittenStory({ id, why }: { id: string; why?: string }) {
  const run = useStore((s) => s.stories[id])
  const source = useStore((s) => s.analysis?.roles.source ?? '')
  const formatPref = useStore((s) => s.formatPref)
  const story = storyById(id)
  const [lang, setLang] = useState<'en' | 'ml'>('en')
  const [ref, w] = useWidth<HTMLDivElement>()
  const [askFormat, setAskFormat] = useState(false)
  if (!story) return null
  const content = lang === 'en' ? run?.en : run?.ml ?? run?.en
  const open = (format: 'article' | 'carousel') => setState((s) => ({ phase: 'studio', selected: id, view: { ...s.view, format, template: format === 'article' ? 'broadsheet' : 'big-number' } }))
  return (
    <div className="rounded-xl border bg-card/40">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Badge variant="outline">{KIND[story.kind] ?? story.kind}</Badge>
        <GateBadge label="EN" gate={run?.gateEn} fixed={run?.fixedEn} busy={run?.status === 'writing' && !run.en} />
        <GateBadge label="മലയാളം" gate={run?.gateMl} fixed={run?.fixedMl} busy={run?.status === 'writing' && !run.ml} />
        {run?.phase && <span className="text-xs text-muted-foreground">{run.phase}...</span>}
        <div className="ml-auto flex items-center gap-2">
          <Segmented size="sm" value={lang} onChange={setLang} options={[{ value: 'en', label: 'EN' }, { value: 'ml', label: 'മലയാളം' }]} />
          <Button size="sm" variant="brand" disabled={!run?.en} onClick={() => (formatPref === 'later' ? setAskFormat(true) : open(formatPref))}>
            Use this story <ArrowRight />
          </Button>
        </div>
      </div>
      {askFormat && (
        <div className="flex flex-wrap items-center gap-3 border-b bg-brand/5 px-4 py-3 text-sm">
          <Sparkles className="size-4 text-brand" />
          <span className="font-medium">Which format?</span>
          <Button size="sm" variant="outline" onClick={() => open('article')}>Article (5 templates)</Button>
          <Button size="sm" variant="outline" onClick={() => open('carousel')}>Social carousel (5 templates)</Button>
          <span className="text-muted-foreground">You can switch any time.</span>
        </div>
      )}
      {why && <div className="border-b px-4 py-2 text-[13px] text-muted-foreground"><b className="text-foreground">Why it's a top story:</b> {why}</div>}
      {run?.error && <div className="px-4 py-3 text-sm text-destructive">{run.error} <Button size="sm" variant="link" onClick={() => { setState((s) => ({ stories: { ...s.stories, [id]: { status: 'idle' } } })); void writeStory(id) }}>Try again</Button></div>}
      <div ref={ref} className="max-h-[70vh] overflow-y-auto scroll-thin rounded-b-xl">
        {content ? (
          <ArticleView story={story} content={content} lang={lang === 'ml' && run?.ml ? 'ml' : 'en'} theme={getTheme('house')} template="broadsheet" width={w} source={source} glossary={run?.ml?.glossary} />
        ) : (
          <Skeleton story={story} />
        )}
      </div>
    </div>
  )
}

function Skeleton({ story }: { story: Story }) {
  return (
    <div className="space-y-3 p-8">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Writing from {story.facts.length} checked facts</div>
      <div className="font-serif text-3xl text-muted-foreground/70">{story.title}</div>
      <p className="text-sm text-muted-foreground">{story.finding}</p>
      {[90, 96, 80, 92, 70].map((x, i) => (
        <div key={i} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${x}%` }} />
      ))}
    </div>
  )
}

function LeadCard({ id, headline, why }: { id: string; headline: string; why?: string }) {
  const story = storyById(id)
  const run = useStore((s) => s.stories[id])
  const [ref, w] = useWidth<HTMLDivElement>()
  const theme = getTheme('ink')
  if (!story) return null
  const key = story.facts.find((f) => f.kind === 'pct' || f.kind === 'rank' || f.kind === 'ratio' || f.kind === 'count') ?? story.facts[0]
  return (
    <div className={cn('rounded-xl border border-dashed bg-card/30 p-4', run?.status === 'done' && 'border-solid')}>
      <div className="mb-1.5 flex items-center gap-2">
        <Badge variant="brand">{KIND[story.kind] ?? story.kind}</Badge>
        <span className="text-[11px] text-muted-foreground">{run?.status === 'done' ? 'Written ✓' : run?.status === 'writing' ? 'Writing...' : 'Not written yet'}</span>
      </div>
      <div className="font-serif text-xl font-semibold leading-snug">{headline}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-bold tabular-nums text-brand">{key?.en}</div>
        <div className="text-[12px] leading-snug text-muted-foreground">{story.finding}</div>
      </div>
      <div ref={ref} className="mt-2 rounded-md bg-black/20 px-2 py-1.5">
        <Chart spec={{ ...story.chart, bars: story.chart.bars?.slice(0, story.chart.type === 'grouped' ? 6 : 8) }} theme={{ ...theme, bg: 'transparent', surface: 'transparent' }} width={Math.max(160, w - 16)} height={story.chart.type === 'grouped' ? 170 : 140} fontSize={10.5} />
      </div>
      {why && (
        <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
          <b className="text-foreground">Why it's easy to miss:</b> {why}
        </p>
      )}
      <div className="mt-3">
        {run?.status === 'done' ? (
          <Button size="sm" variant="outline" onClick={() => setState({ selected: id })}>Open the written story</Button>
        ) : (
          <Button size="sm" variant="secondary" disabled={run?.status === 'writing'} onClick={() => { setState({ selected: id }); void writeStory(id) }}>
            {run?.status === 'writing' ? <Loader2 className="animate-spin" /> : <PenLine />} Write this story
          </Button>
        )}
      </div>
    </div>
  )
}

/** While the desk works: the same six stages as the side panel, big and plain. */
function Reading() {
  const stages = useStages()
  const error = useStore((s) => s.error)
  return (
    <div className="mx-auto max-w-2xl rounded-xl border bg-card/40 p-6">
      <div className="mb-4 font-semibold">Working on it. This takes a few seconds.</div>
      <ol className="space-y-3">
        {stages.slice(0, 5).map((st) => (
          <li key={st.id} className="flex items-center gap-3">
            <span className={cn('grid size-7 place-items-center rounded-full', st.status === 'done' ? 'bg-ok/15 text-ok' : st.status === 'working' ? 'bg-brand/15 text-brand' : st.status === 'error' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground')}>
              {st.status === 'working' ? <Loader2 className="size-4 animate-spin" /> : st.status === 'done' ? '✓' : st.status === 'error' ? '!' : '·'}
            </span>
            <span className={cn('flex-1', st.status === 'waiting' && 'text-muted-foreground')}>{st.title}</span>
            {st.stat && <span className="text-sm text-muted-foreground tabular-nums">{st.stat}</span>}
          </li>
        ))}
      </ol>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  )
}
