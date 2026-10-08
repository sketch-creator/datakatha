import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ClipboardCopy, Download, FileCode2, Images, Loader2, RotateCcw, ShieldCheck } from 'lucide-react'
import { storyById, writeStory } from '@/llm/pipeline'
import { setState, useStore, type Format, type ViewLang } from '@/state/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { GateBadge, GateList } from '@/components/GateBadge'
import { ArticleView, CarouselView, Slide } from '@/components/StoryPreview'
import { ARTICLE_TEMPLATES } from '@/templates/article'
import { CAROUSEL_TEMPLATES, slidesFor } from '@/templates/carousel'
import { getTheme, THEMES } from '@/templates/themes'
import { articleHtml, articleText, canExport, slug, zipSlides } from '@/lib/export'
import { useWidth } from './Board'
import { cn } from '@/lib/utils'

export function Studio() {
  const id = useStore((s) => s.selected)!
  const view = useStore((s) => s.view)
  const run = useStore((s) => s.stories[id])
  const source = useStore((s) => s.analysis?.roles.source ?? '')
  const story = storyById(id)
  const [ref, w] = useWidth<HTMLDivElement>()
  const [exporting, setExporting] = useState('')
  const [copied, setCopied] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLDivElement>(null)
  const [exportLang, setExportLang] = useState<'en' | 'ml' | null>(null)
  // "Export anyway" applies to the story it was ticked on only.
  const [anywayId, setAnywayId] = useState<string | null>(null)
  const anyway = anywayId === id

  useEffect(() => {
    if (story && (!run || run.status === 'idle')) void writeStory(id)
  }, [id, story, run])

  if (!story) return null
  const theme = getTheme(view.theme, view.accent || undefined)
  const setView = (p: Partial<typeof view>) => setState((s) => ({ view: { ...s.view, ...p } }))
  const templates = view.format === 'article' ? ARTICLE_TEMPLATES : CAROUSEL_TEMPLATES
  const langs: ('en' | 'ml')[] = view.lang === 'both' ? ['en', 'ml'] : [view.lang]
  const contentOf = (l: 'en' | 'ml') => (l === 'en' ? run?.en : run?.ml)
  const ready = langs.every((l) => contentOf(l))
  const gateOf = (l: 'en' | 'ml') => (l === 'en' ? run?.gateEn : run?.gateMl)
  const ok = (l: 'en' | 'ml') => canExport(gateOf(l), anyway)
  const failedLangs = (['en', 'ml'] as const).filter((l) => gateOf(l)?.verdict === 'FAIL')

  async function exportPngs(l: 'en' | 'ml') {
    setExportLang(l)
    setExporting(`Rendering ${l === 'en' ? 'English' : 'Malayalam'} slides...`)
    await new Promise((r) => setTimeout(r, 300))
    const nodes = [...(exportRef.current?.querySelectorAll<HTMLElement>('[data-slide]') ?? [])].map((n) => n.firstElementChild?.firstElementChild?.firstElementChild as HTMLElement).filter(Boolean)
    try {
      await zipSlides(nodes, `${slug(run?.en?.headline ?? story!.title)}-${l}-${view.template}`, (i) => setExporting(`Rendering slide ${i + 1} of ${nodes.length}...`))
    } finally {
      setExporting('')
      setExportLang(null)
    }
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Controls */}
      <div className="w-64 shrink-0 space-y-6 overflow-y-auto border-r p-4 scroll-thin">
        <Button variant="ghost" size="sm" onClick={() => setState({ phase: 'board' })} className="-ml-2">
          <ArrowLeft /> All stories
        </Button>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format</div>
          <Segmented<Format>
            className="w-full [&>button]:flex-1"
            value={view.format}
            onChange={(f) => setView({ format: f, template: f === 'article' ? 'broadsheet' : 'big-number' })}
            options={[
              { value: 'article', label: 'Article' },
              { value: 'carousel', label: 'Carousel' },
            ]}
          />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Template · {templates.length}</div>
          <div className="space-y-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setView({ template: t.id })}
                className={cn('w-full rounded-lg border p-2.5 text-left transition-colors cursor-pointer', view.template === t.id ? 'border-brand bg-brand/10' : 'hover:bg-accent/50')}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Thumb id={t.id} format={view.format} active={view.template === t.id} />
                  {t.name}
                </div>
                <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{t.hint}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Colour theme</div>
          <div className="grid grid-cols-5 gap-2">
            {THEMES.map((t) => (
              <button key={t.id} title={t.name} onClick={() => setView({ theme: t.id })} className={cn('flex flex-col items-center gap-1 cursor-pointer')}>
                <span className={cn('relative size-9 overflow-hidden rounded-full border-2', view.theme === t.id ? 'border-brand' : 'border-transparent')} style={{ background: t.bg }}>
                  <span className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: t.accent }} />
                </span>
                <span className="text-[10px] text-muted-foreground">{t.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <input type="color" value={view.accent || theme.accent} onChange={(e) => setView({ accent: e.target.value })} className="size-8 cursor-pointer rounded border bg-transparent" />
            <span className="text-muted-foreground">Custom accent</span>
            {view.accent && (
              <Button variant="ghost" size="icon" className="ml-auto size-7" title="Back to theme colour" onClick={() => setView({ accent: '' })}>
                <RotateCcw className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Export</div>
          {view.format === 'carousel' ? (
            <>
              <Button variant="outline" size="sm" className="w-full justify-start" disabled={!run?.en || !ok('en') || !!exporting} onClick={() => exportPngs('en')}><Images /> PNG slides · English</Button>
              <Button variant="outline" size="sm" className="w-full justify-start" disabled={!run?.ml || !ok('ml') || !!exporting} onClick={() => exportPngs('ml')}><Images /> PNG slides · മലയാളം</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="w-full justify-start" disabled={!ready || !ok(langs[0])} onClick={() => { const n = articleRef.current?.querySelector('article'); if (n) articleHtml(n, run?.en?.headline ?? 'article', langs[0]) }}><FileCode2 /> HTML page ({langs[0] === 'en' ? 'EN' : 'ML'})</Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            disabled={!ready || !langs.every(ok)}
            onClick={async () => {
              await navigator.clipboard.writeText(langs.map((l) => articleText(contentOf(l)!, source, l)).join('\n\n---\n\n'))
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            <ClipboardCopy /> {copied ? 'Copied' : 'Copy text for the CMS'}
          </Button>
          {failedLangs.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
              <p className="text-destructive">
                The {failedLangs.map((l) => (l === 'en' ? 'English' : 'Malayalam')).join(' and ')} version failed the fact-check, so export is off. Fix the red items below first.
              </p>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-muted-foreground">
                <input type="checkbox" checked={anyway} onChange={(e) => setAnywayId(e.target.checked ? id : null)} />
                Export anyway
              </label>
            </div>
          )}
          {exporting && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />{exporting}</p>}
        </div>
      </div>

      {/* Preview */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Step 3 of 3 · Make it</div>
            <div className="truncate font-serif text-lg font-semibold">{run?.en?.headline ?? story.title}</div>
          </div>
          <GateBadge label="EN" gate={run?.gateEn} fixed={run?.fixedEn} busy={run?.status === 'writing' && !run.en} />
          <GateBadge label="മലയാളം" gate={run?.gateMl} fixed={run?.fixedMl} busy={run?.status === 'writing' && !run.ml} />
          <Segmented<ViewLang>
            value={view.lang}
            onChange={(l) => setView({ lang: l })}
            options={[
              { value: 'en', label: 'EN' },
              { value: 'ml', label: 'മലയാളം' },
              { value: 'both', label: 'Both' },
            ]}
          />
        </div>
        <div ref={ref} className="flex-1 overflow-auto bg-[oklch(0.12_0.004_286)] p-6 scroll-thin">
          {!ready ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="animate-spin" /> {run?.phase ?? 'Writing'}...
            </div>
          ) : view.format === 'article' ? (
            <div ref={articleRef} className={cn('mx-auto flex gap-6', view.lang === 'both' ? 'justify-center' : '')} style={{ width: view.lang === 'both' ? undefined : Math.min(760, w - 48) }}>
              {langs.map((l) => (
                <div key={l} className="overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10">
                  <ArticleView story={story} content={contentOf(l)!} lang={l} theme={theme} template={view.template} width={view.lang === 'both' ? Math.min(640, (w - 72) / 2) : Math.min(760, w - 48)} source={source} glossary={run?.ml?.glossary} />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {langs.map((l) => (
                <div key={l}>
                  {view.lang === 'both' && <div className="mb-2 text-xs font-semibold text-muted-foreground">{l === 'en' ? 'English' : 'മലയാളം'}</div>}
                  <CarouselView story={story} content={contentOf(l)!} lang={l} theme={theme} template={view.template} source={source} glossary={run?.ml?.glossary} scale={view.lang === 'both' ? 0.24 : 0.32} />
                </div>
              ))}
            </div>
          )}
          {ready && <FactCheck id={id} />}
        </div>
      </div>

      {/* Full-size slides for PNG export, off screen */}
      {exportLang && run && contentOf(exportLang) && (
        <div ref={exportRef} style={{ position: 'fixed', left: -20000, top: 0 }} aria-hidden>
          {slidesFor(contentOf(exportLang)!, view.template).map((_, i, arr) => (
            <div key={i} data-slide>
              <Slide story={story} content={contentOf(exportLang)!} lang={exportLang} theme={theme} template={view.template} index={i} total={arr.length} source={source} glossary={run.ml?.glossary} scale={1} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FactCheck({ id }: { id: string }) {
  const run = useStore((s) => s.stories[id])
  const [lang, setLang] = useState<'en' | 'ml'>('en')
  const gate = lang === 'en' ? run?.gateEn : run?.gateMl
  if (!gate) return null
  return (
    <div className="mx-auto mt-8 max-w-3xl rounded-xl border bg-card/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="size-4 text-ok" />
        <div className="font-semibold">Fact-check report</div>
        <Badge variant="outline" className="text-[10px]">code, independent of the writer</Badge>
        <Segmented size="sm" className="ml-auto" value={lang} onChange={setLang} options={[{ value: 'en', label: 'English' }, { value: 'ml', label: 'മലയാളം' }]} />
      </div>
      <GateList gate={gate} extra={lang === 'ml' ? run?.parity ?? [] : []} compact />
      {(lang === 'en' ? run?.fixedEn : run?.fixedMl) && <p className="mt-2 text-xs text-warn">The first draft failed; the desk sent the fix list back to the writer once and re-checked. See Under the hood.</p>}
      <p className="mt-2 text-xs text-muted-foreground">Big numbers on cards and slides are drawn from the fact book itself, not from the writer's text.</p>
      <Button variant="link" size="sm" className="px-0" onClick={() => download(run)}>
        <Download /> Download the run log (JSON)
      </Button>
    </div>
  )
}

function download(run: unknown) {
  const blob = new Blob([JSON.stringify(run, null, 1)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'fact-check-run.json'
  a.click()
}

function Thumb({ id, format, active }: { id: string; format: Format; active: boolean }) {
  const c = active ? 'var(--brand)' : 'oklch(0.6 0.01 286)'
  const box = (children: React.ReactNode) => (
    <svg viewBox="0 0 24 30" className="h-6 w-5 shrink-0" fill="none" stroke={c} strokeWidth="1.4">
      <rect x="1" y="1" width="22" height="28" rx="2" />
      {children}
    </svg>
  )
  if (format === 'carousel') {
    if (id === 'big-number') return box(<text x="5" y="19" fontSize="10" fill={c} stroke="none" fontWeight="700">8.7</text>)
    if (id === 'chart-walk') return box(<path d="M4 22l5-6 4 3 7-9" />)
    if (id === 'blocks') return box(<rect x="1" y="1" width="22" height="14" fill={c} />)
    if (id === 'quote') return box(<text x="5" y="16" fontSize="14" fill={c} stroke="none">“</text>)
    return box(<><circle cx="6" cy="10" r="2" fill={c} /><circle cx="12" cy="10" r="2" /><circle cx="18" cy="10" r="2" /><path d="M8 10h2M14 10h2" /></>)
  }
  if (id === 'broadsheet') return box(<><path d="M4 6h16M4 9h12" strokeWidth="2" /><path d="M4 14h16M4 17h16M4 20h10M4 23h16" /></>)
  if (id === 'big-number') return box(<><rect x="1" y="1" width="22" height="11" fill={c} /><path d="M4 16h16M4 19h16M4 22h12" /></>)
  if (id === 'chart-led') return box(<><path d="M4 12l4-4 4 2 8-6" /><path d="M4 17h16M4 20h16M4 23h12" /></>)
  if (id === 'explainer') return box(<><path d="M4 6h3M4 13h3M4 20h3" strokeWidth="2" /><path d="M9 6h11M9 13h11M9 20h11" /></>)
  return box(<><rect x="3" y="5" width="8" height="9" /><rect x="13" y="5" width="8" height="9" fill={c} /><path d="M4 18h16M4 21h16M4 24h12" /></>)
}
