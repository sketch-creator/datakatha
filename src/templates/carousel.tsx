// Five carousel styles. Slides are drawn at full size (1080 x 1350, Instagram portrait)
// and scaled for preview, so the PNG export is pixel-exact.
import { Chart } from '@/components/Chart'
import type { StoryContent } from '@/llm/content'
import { factText, fonts, k, L, sourceLine, type TemplateProps } from './shared'

export const SLIDE_W = 1080
export const SLIDE_H = 1350

export const CAROUSEL_TEMPLATES = [
  { id: 'big-number', name: 'Big number', hint: 'One huge checked number per slide' },
  { id: 'chart-walk', name: 'Chart walk-through', hint: 'The chart builds up slide by slide' },
  { id: 'blocks', name: 'Bold colour blocks', hint: 'Full-bleed colour, big type' },
  { id: 'quote', name: 'Minimal quote cards', hint: 'Quiet cards, one line each' },
  { id: 'timeline', name: 'Timeline', hint: 'A dated rail, one moment per slide' },
] as const

export interface SlideProps extends TemplateProps {
  index: number
  total: number
}

type Slide = StoryContent['slides'][number]

export function slidesFor(c: StoryContent, template: string): Slide[] {
  const s = c.slides.length ? c.slides : [{ kicker: c.kicker, headline: c.headline, body: c.dek }]
  if (template !== 'timeline' || !c.timeline.length) return s.slice(0, 7)
  const items = c.timeline.slice(0, 5).map((t) => ({ kicker: t.year, headline: t.year, body: t.text }))
  return [s[0], ...items, s[s.length - 1]]
}

function Frame({ p, bg, color, children, footerColor }: { p: SlideProps; bg: string; color: string; children: React.ReactNode; footerColor?: string }) {
  return (
    <div lang={p.lang} style={{ width: SLIDE_W, height: SLIDE_H, background: bg, color, position: 'relative', overflow: 'hidden', boxSizing: 'border-box', padding: '96px 88px 150px', display: 'flex', flexDirection: 'column' }}>
      {children}
      <div style={{ position: 'absolute', left: 88, right: 88, bottom: 60, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontFamily: fonts.sans(p.lang), fontSize: 24 * k(p.lang), color: footerColor ?? color, opacity: 0.75 }}>
        <span style={{ maxWidth: 720 }}>{sourceLine(p.source, p.lang)}</span>
        <span style={{ fontWeight: 700 }}>
          {L.desk[p.lang]} · {p.index + 1}/{p.total}
        </span>
      </div>
    </div>
  )
}

const kick = (p: SlideProps, text: string, color: string) => (
  <div style={{ fontFamily: fonts.sans(p.lang), fontWeight: 700, fontSize: 30 * k(p.lang), letterSpacing: p.lang === 'en' ? '0.1em' : 0, textTransform: p.lang === 'en' ? 'uppercase' : 'none', color }}>{text}</div>
)

function Cover({ p, bg, ink, accent }: { p: SlideProps; bg: string; ink: string; accent: string }) {
  return (
    <Frame p={p} bg={bg} color={ink}>
      {kick(p, p.content.kicker, accent)}
      <div style={{ fontFamily: fonts.serif(p.lang), fontWeight: 700, fontSize: (p.content.headline.length > 50 ? 84 : 100) * k(p.lang), lineHeight: p.lang === 'ml' ? 1.3 : 1.04, letterSpacing: p.lang === 'en' ? '-0.02em' : 0, marginTop: 40 }}>{p.content.headline}</div>
      <div style={{ fontFamily: fonts.sans(p.lang), fontSize: 34 * k(p.lang), lineHeight: 1.4, marginTop: 36, opacity: 0.8 }}>{p.content.dek}</div>
      <div style={{ marginTop: 'auto', fontFamily: fonts.sans(p.lang), fontWeight: 700, fontSize: 30 * k(p.lang), color: accent }}>{L.swipe[p.lang]}</div>
    </Frame>
  )
}

function Closing({ p, bg, ink, accent }: { p: SlideProps; bg: string; ink: string; accent: string }) {
  const s = slidesFor(p.content, 'x')
  const last = s[s.length - 1]
  return (
    <Frame p={p} bg={bg} color={ink}>
      {kick(p, last?.kicker || L.caveat[p.lang], accent)}
      <div style={{ fontFamily: fonts.serif(p.lang), fontWeight: 700, fontSize: 70 * k(p.lang), lineHeight: p.lang === 'ml' ? 1.35 : 1.1, marginTop: 36 }}>{last?.headline}</div>
      <div style={{ fontFamily: fonts.sans(p.lang), fontSize: 36 * k(p.lang), lineHeight: 1.45, marginTop: 30 }}>{last?.body}</div>
      <div style={{ marginTop: 'auto', fontFamily: fonts.sans(p.lang), fontSize: 27 * k(p.lang), lineHeight: 1.45, opacity: 0.85, borderTop: `3px solid ${accent}`, paddingTop: 24 }}>
        <strong>{L.caveat[p.lang]}: </strong>
        {p.content.caveat}
      </div>
    </Frame>
  )
}

const isEdge = (p: SlideProps) => p.index === 0 || p.index === p.total - 1

export function BigNumberSlide(p: SlideProps) {
  const t = p.theme
  const slide = slidesFor(p.content, 'big-number')[p.index]
  if (p.index === 0) return <Cover p={p} bg={t.bg} ink={t.ink} accent={t.accent} />
  if (p.index === p.total - 1) return <Closing p={p} bg={t.bg} ink={t.ink} accent={t.accent} />
  const big = factText(p.story, slide.fact_id, p.lang)
  return (
    <Frame p={p} bg={t.bg} color={t.ink}>
      {kick(p, slide.kicker, t.accent)}
      <div style={{ fontFamily: fonts.display(p.lang), fontWeight: 800, fontSize: (big.length > 16 ? 120 : big.length > 10 ? 150 : 200) * k(p.lang), lineHeight: 1, letterSpacing: '-0.04em', color: t.accent, margin: '70px 0 40px' }}>{big || '—'}</div>
      <div style={{ fontFamily: fonts.serif(p.lang), fontWeight: 700, fontSize: 64 * k(p.lang), lineHeight: p.lang === 'ml' ? 1.35 : 1.1 }}>{slide.headline}</div>
      <div style={{ fontFamily: fonts.sans(p.lang), fontSize: 36 * k(p.lang), lineHeight: 1.45, marginTop: 28, opacity: 0.85 }}>{slide.body}</div>
    </Frame>
  )
}

export function ChartWalkSlide(p: SlideProps) {
  const t = p.theme
  const slide = slidesFor(p.content, 'chart-walk')[p.index]
  if (p.index === p.total - 1) return <Closing p={p} bg={t.bg} ink={t.ink} accent={t.accent} />
  const n = (p.story.chart.series?.length ?? p.story.chart.bars?.length ?? 1) || 1
  const reveal = p.index === 0 ? n : Math.min(n, p.index)
  return (
    <Frame p={p} bg={t.bg} color={t.ink}>
      {kick(p, p.index === 0 ? p.content.kicker : slide.kicker, t.accent)}
      <div style={{ fontFamily: fonts.serif(p.lang), fontWeight: 700, fontSize: (p.index === 0 ? 72 : 56) * k(p.lang), lineHeight: p.lang === 'ml' ? 1.32 : 1.08, margin: '26px 0 18px' }}>{p.index === 0 ? p.content.headline : slide.headline}</div>
      <div style={{ fontFamily: fonts.sans(p.lang), fontSize: 30 * k(p.lang), lineHeight: 1.4, opacity: 0.8, marginBottom: 30 }}>{p.index === 0 ? p.content.chart_subtitle : slide.body}</div>
      <div style={{ marginTop: 'auto' }}>
        <Chart spec={p.story.chart} theme={t} width={SLIDE_W - 176} height={520} reveal={p.index === 0 ? undefined : reveal} names={p.lang === 'ml' ? p.names : undefined} fontFamily={fonts.sans(p.lang)} fontSize={26} />
      </div>
    </Frame>
  )
}

export function BlocksSlide(p: SlideProps) {
  const t = p.theme
  const slide = slidesFor(p.content, 'blocks')[p.index]
  const odd = p.index % 2 === 1
  const bg = odd ? t.ink : t.accent
  const ink = odd ? t.bg : t.onAccent
  if (p.index === 0) return <Cover p={p} bg={t.accent} ink={t.onAccent} accent={t.onAccent} />
  if (p.index === p.total - 1) return <Closing p={p} bg={t.ink} ink={t.bg} accent={t.accent} />
  const big = factText(p.story, slide.fact_id, p.lang)
  return (
    <Frame p={p} bg={bg} color={ink}>
      {kick(p, slide.kicker, odd ? t.accent : ink)}
      <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
        {big && <div style={{ fontFamily: fonts.display(p.lang), fontWeight: 800, fontSize: (big.length > 14 ? 110 : 150) * k(p.lang), lineHeight: 1, marginBottom: 30, color: odd ? t.accent : ink }}>{big}</div>}
        <div style={{ fontFamily: fonts.display(p.lang), fontWeight: 800, fontSize: 84 * k(p.lang), lineHeight: p.lang === 'ml' ? 1.3 : 1.02, letterSpacing: p.lang === 'en' ? '-0.025em' : 0 }}>{slide.headline}</div>
        <div style={{ fontFamily: fonts.sans(p.lang), fontSize: 36 * k(p.lang), lineHeight: 1.45, marginTop: 30, opacity: 0.9 }}>{slide.body}</div>
      </div>
    </Frame>
  )
}

export function QuoteSlide(p: SlideProps) {
  const t = p.theme
  const slide = slidesFor(p.content, 'quote')[p.index]
  if (isEdge(p) && p.index === p.total - 1) return <Closing p={p} bg={t.surface} ink={t.ink} accent={t.accent} />
  const text = p.index === 0 ? p.content.headline : slide.body || slide.headline
  return (
    <Frame p={p} bg={t.surface} color={t.ink}>
      <div style={{ fontFamily: fonts.serif('en'), fontSize: 260, lineHeight: 0.8, color: t.accent, height: 170 }}>“</div>
      <div style={{ fontFamily: fonts.serif(p.lang), fontSize: (text.length > 120 ? 54 : 66) * k(p.lang), lineHeight: p.lang === 'ml' ? 1.45 : 1.25, fontWeight: 500 }}>{text}</div>
      <div style={{ marginTop: 'auto', display: 'flex', gap: 22, alignItems: 'center' }}>
        <div style={{ width: 80, height: 6, background: t.accent }} />
        <div style={{ fontFamily: fonts.sans(p.lang), fontSize: 30 * k(p.lang), fontWeight: 700, color: t.muted }}>{p.index === 0 ? p.content.kicker : slide.kicker}</div>
      </div>
    </Frame>
  )
}

export function TimelineSlide(p: SlideProps) {
  const t = p.theme
  const slides = slidesFor(p.content, 'timeline')
  const slide = slides[p.index]
  if (p.index === 0) return <Cover p={p} bg={t.bg} ink={t.ink} accent={t.accent} />
  if (p.index === p.total - 1) return <Closing p={p} bg={t.bg} ink={t.ink} accent={t.accent} />
  const years = slides.slice(1, -1).map((s) => s.headline)
  return (
    <Frame p={p} bg={t.bg} color={t.ink}>
      {kick(p, L.timeline[p.lang], t.accent)}
      <div style={{ display: 'flex', gap: 0, margin: '50px 0 70px', alignItems: 'center' }}>
        {years.map((_, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: i === p.index - 1 ? 38 : 22, height: i === p.index - 1 ? 38 : 22, borderRadius: 99, background: i <= p.index - 1 ? t.accent : t.context, flexShrink: 0 }} />
            {i < years.length - 1 && <div style={{ height: 6, flex: 1, background: i < p.index - 1 ? t.accent : t.context }} />}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: fonts.display('en'), fontWeight: 800, fontSize: 230, lineHeight: 0.9, color: t.accent, letterSpacing: '-0.04em' }}>{slide.headline}</div>
      <div style={{ fontFamily: fonts.serif(p.lang), fontSize: 54 * k(p.lang), lineHeight: p.lang === 'ml' ? 1.45 : 1.25, marginTop: 50, fontWeight: 500 }}>{slide.body}</div>
    </Frame>
  )
}

export const CAROUSEL_COMPONENTS: Record<string, (p: SlideProps) => React.ReactElement> = {
  'big-number': BigNumberSlide,
  'chart-walk': ChartWalkSlide,
  blocks: BlocksSlide,
  quote: QuoteSlide,
  timeline: TimelineSlide,
}
