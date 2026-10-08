// Five article layouts. All read the same StoryContent; numbers in big type come
// from the fact book (factText), not from the model's wording.
import { Chart } from '@/components/Chart'
import { factText, fonts, k, L, sourceLine, today, type TemplateProps } from './shared'

export const ARTICLE_TEMPLATES = [
  { id: 'broadsheet', name: 'Broadsheet', hint: 'Classic news page: headline, dek, chart after the second paragraph' },
  { id: 'big-number', name: 'Big-number lead', hint: 'One huge number opens the story' },
  { id: 'chart-led', name: 'Chart-led', hint: 'The chart is the lead; short text below' },
  { id: 'explainer', name: 'Explainer Q&A', hint: 'Reader questions as subheads' },
  { id: 'then-now', name: 'Then vs Now', hint: 'Split panel comparing the two years' },
] as const

function Kicker({ p }: { p: TemplateProps }) {
  return (
    <div style={{ color: p.theme.accent, fontFamily: fonts.sans(p.lang), fontSize: 12.5 * k(p.lang), fontWeight: 700, letterSpacing: p.lang === 'en' ? '0.09em' : 0, textTransform: p.lang === 'en' ? 'uppercase' : 'none' }}>
      {p.content.kicker}
    </div>
  )
}

function Headline({ p, size = 40 }: { p: TemplateProps; size?: number }) {
  return (
    <h1 style={{ fontFamily: fonts.serif(p.lang), fontSize: size * k(p.lang), lineHeight: p.lang === 'ml' ? 1.35 : 1.08, fontWeight: p.lang === 'ml' ? 700 : 600, letterSpacing: p.lang === 'en' ? '-0.015em' : 0, margin: '10px 0 12px' }}>
      {p.content.headline}
    </h1>
  )
}

function Dek({ p }: { p: TemplateProps }) {
  return <p style={{ fontFamily: fonts.serif(p.lang), fontSize: 19 * k(p.lang), lineHeight: 1.45, color: p.theme.muted, margin: '0 0 16px', fontStyle: p.lang === 'en' ? 'italic' : 'normal' }}>{p.content.dek}</p>
}

function Byline({ p }: { p: TemplateProps }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontFamily: fonts.sans(p.lang), fontSize: 12.5 * k(p.lang), color: p.theme.muted, borderTop: `1px solid ${p.theme.grid}`, borderBottom: `1px solid ${p.theme.grid}`, padding: '9px 0', margin: '4px 0 22px' }}>
      <strong style={{ color: p.theme.ink }}>{L.desk[p.lang]}</strong>
      <span>·</span>
      <span>{today()}</span>
    </div>
  )
}

function Para({ p, text, first }: { p: TemplateProps; text: string; first?: boolean }) {
  const style = { fontFamily: fonts.serif(p.lang), fontSize: 18 * k(p.lang), lineHeight: p.lang === 'ml' ? 1.85 : 1.62, margin: '0 0 1.05em' }
  if (first && p.lang === 'en' && text.length > 1)
    return (
      <p style={style}>
        <span style={{ float: 'left', fontSize: 58, lineHeight: 0.86, padding: '6px 8px 0 0', fontWeight: 600, color: p.theme.accent }}>{text[0]}</span>
        {text.slice(1)}
      </p>
    )
  return <p style={style}>{text}</p>
}

function Figure({ p, width, height = 300 }: { p: TemplateProps; width: number; height?: number }) {
  return (
    <figure style={{ margin: '8px 0 26px' }}>
      <div style={{ fontFamily: fonts.sans(p.lang), fontWeight: 700, fontSize: 16 * k(p.lang), marginBottom: 2 }}>{p.content.chart_title || p.story.chart.title}</div>
      <div style={{ fontFamily: fonts.sans(p.lang), fontSize: 13 * k(p.lang), color: p.theme.muted, marginBottom: 8 }}>{p.content.chart_subtitle || p.story.chart.subtitle}</div>
      <Chart spec={p.story.chart} theme={p.theme} width={width} height={height} names={p.lang === 'ml' ? p.names : undefined} fontFamily={fonts.sans(p.lang)} />
      <figcaption style={{ fontFamily: fonts.sans(p.lang), fontSize: 11.5 * k(p.lang), color: p.theme.muted, marginTop: 6 }}>{sourceLine(p.source, p.lang)}</figcaption>
    </figure>
  )
}

function KeyPoints({ p, title = L.keyPoints[p.lang] }: { p: TemplateProps; title?: string }) {
  if (!p.content.key_points.length) return null
  return (
    <aside style={{ background: p.theme.bg, borderLeft: `4px solid ${p.theme.accent}`, padding: '14px 18px', margin: '6px 0 24px', fontFamily: fonts.sans(p.lang) }}>
      <div style={{ fontWeight: 700, fontSize: 13 * k(p.lang), marginBottom: 6, color: p.theme.accent }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15 * k(p.lang), lineHeight: 1.55 }}>
        {p.content.key_points.map((x, i) => (
          <li key={i} style={{ margin: '3px 0' }}>{x}</li>
        ))}
      </ul>
    </aside>
  )
}

function Caveat({ p }: { p: TemplateProps }) {
  if (!p.content.caveat) return null
  return (
    <p style={{ fontFamily: fonts.sans(p.lang), fontSize: 13.5 * k(p.lang), color: p.theme.muted, borderTop: `1px solid ${p.theme.grid}`, paddingTop: 12, marginTop: 8 }}>
      <strong style={{ color: p.theme.ink }}>{L.caveat[p.lang]}: </strong>
      {p.content.caveat}
    </p>
  )
}

function Shell({ p, children, pad = 44 }: { p: TemplateProps; children: React.ReactNode; pad?: number }) {
  return (
    <article lang={p.lang} style={{ background: p.theme.surface, color: p.theme.ink, width: p.width, padding: `${pad}px ${Math.max(24, Math.min(56, p.width * 0.07))}px`, boxSizing: 'border-box' }}>
      {children}
    </article>
  )
}

const inner = (p: TemplateProps) => p.width - 2 * Math.max(24, Math.min(56, p.width * 0.07))

export function Broadsheet(p: TemplateProps) {
  const b = p.content.body
  return (
    <Shell p={p}>
      <Kicker p={p} />
      <Headline p={p} />
      <Dek p={p} />
      <Byline p={p} />
      {b.slice(0, 2).map((t, i) => <Para key={i} p={p} text={t} first={i === 0} />)}
      <Figure p={p} width={inner(p)} />
      {b.slice(2).map((t, i) => <Para key={i} p={p} text={t} />)}
      <KeyPoints p={p} />
      <Caveat p={p} />
    </Shell>
  )
}

export function BigNumber(p: TemplateProps) {
  const value = factText(p.story, p.content.big_number.fact_id, p.lang) || p.content.big_number.value
  return (
    <Shell p={p} pad={0}>
      <div style={{ background: p.theme.accent, color: p.theme.onAccent, margin: `0 -${Math.max(24, Math.min(56, p.width * 0.07))}px`, padding: `48px ${Math.max(24, Math.min(56, p.width * 0.07))}px 40px` }}>
        <div style={{ fontFamily: fonts.display(p.lang), fontWeight: 800, fontSize: Math.min(110, p.width / 6.5) * k(p.lang), lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
        <div style={{ fontFamily: fonts.sans(p.lang), fontSize: 18 * k(p.lang), marginTop: 12, maxWidth: 560, opacity: 0.92 }}>{p.content.big_number.caption}</div>
      </div>
      <div style={{ paddingTop: 30, paddingBottom: 40 }}>
        <Kicker p={p} />
        <Headline p={p} size={36} />
        <Dek p={p} />
        <Byline p={p} />
        {p.content.body.slice(0, 3).map((t, i) => <Para key={i} p={p} text={t} />)}
        <Figure p={p} width={inner(p)} height={260} />
        {p.content.body.slice(3).map((t, i) => <Para key={i} p={p} text={t} />)}
        <Caveat p={p} />
      </div>
    </Shell>
  )
}

export function ChartLed(p: TemplateProps) {
  return (
    <Shell p={p}>
      <Kicker p={p} />
      <Figure p={p} width={inner(p)} height={Math.round(inner(p) * 0.62)} />
      <Headline p={p} size={32} />
      <Dek p={p} />
      {p.content.body.slice(0, 3).map((t, i) => <Para key={i} p={p} text={t} />)}
      <KeyPoints p={p} />
      <Caveat p={p} />
    </Shell>
  )
}

export function Explainer(p: TemplateProps) {
  return (
    <Shell p={p}>
      <Kicker p={p} />
      <Headline p={p} />
      <Dek p={p} />
      <Byline p={p} />
      <KeyPoints p={p} title={L.inShort[p.lang]} />
      {p.content.qa.map((x, i) => (
        <section key={i}>
          <h2 style={{ fontFamily: fonts.sans(p.lang), fontSize: 20 * k(p.lang), fontWeight: 700, margin: '22px 0 8px', color: p.theme.ink, display: 'flex', gap: 10 }}>
            <span style={{ color: p.theme.accent }}>{i + 1}.</span>
            {x.q}
          </h2>
          <Para p={p} text={x.a} />
          {i === 0 && <Figure p={p} width={inner(p)} height={260} />}
        </section>
      ))}
      <Caveat p={p} />
    </Shell>
  )
}

export function ThenNow(p: TemplateProps) {
  const tn = p.content.then_now
  const half = (inner(p) - 16) / 2
  const panel = (label: string, text: string, hl: boolean) => (
    <div style={{ width: p.width < 560 ? '100%' : half, background: hl ? p.theme.accent : p.theme.bg, color: hl ? p.theme.onAccent : p.theme.ink, padding: '20px 22px', borderRadius: 6 }}>
      <div style={{ fontFamily: fonts.sans(p.lang), fontSize: 12 * k(p.lang), fontWeight: 700, letterSpacing: '0.08em', opacity: 0.8 }}>{hl ? L.now[p.lang] : L.then[p.lang]}</div>
      <div style={{ fontFamily: fonts.display(p.lang), fontSize: 44, fontWeight: 800, lineHeight: 1.05, margin: '4px 0 8px' }}>{label}</div>
      <div style={{ fontFamily: fonts.serif(p.lang), fontSize: 16.5 * k(p.lang), lineHeight: 1.5 }}>{text}</div>
    </div>
  )
  return (
    <Shell p={p}>
      <Kicker p={p} />
      <Headline p={p} />
      <Dek p={p} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '8px 0 26px' }}>
        {panel(tn.then_label, tn.then_text, false)}
        {panel(tn.now_label, tn.now_text, true)}
      </div>
      <Figure p={p} width={inner(p)} height={260} />
      {p.content.body.slice(0, 4).map((t, i) => <Para key={i} p={p} text={t} />)}
      {p.content.timeline.length > 0 && (
        <div style={{ margin: '10px 0 22px', fontFamily: fonts.sans(p.lang) }}>
          <div style={{ fontWeight: 700, fontSize: 13 * k(p.lang), color: p.theme.accent, marginBottom: 8 }}>{L.timeline[p.lang]}</div>
          {p.content.timeline.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: '7px 0', borderTop: `1px solid ${p.theme.grid}`, fontSize: 15 * k(p.lang) }}>
              <strong style={{ minWidth: 52, color: p.theme.accent }}>{t.year}</strong>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}
      <Caveat p={p} />
    </Shell>
  )
}

export const ARTICLE_COMPONENTS: Record<string, (p: TemplateProps) => React.ReactElement> = {
  broadsheet: Broadsheet,
  'big-number': BigNumber,
  'chart-led': ChartLed,
  explainer: Explainer,
  'then-now': ThenNow,
}
