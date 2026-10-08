// One structured story feeds all ten templates, so switching template or theme
// never needs a new model call.

export interface StoryContent {
  kicker: string
  headline: string
  dek: string
  body: string[]
  big_number: { fact_id: string; value: string; caption: string }
  key_points: string[]
  qa: { q: string; a: string }[]
  then_now: { then_label: string; then_text: string; now_label: string; now_text: string }
  timeline: { year: string; text: string }[]
  slides: { kicker: string; headline: string; body: string; fact_id?: string }[]
  chart_title: string
  chart_subtitle: string
  alt_text: string
  caveat: string
  facts_used: string[]
  glossary?: Record<string, string>
}

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const arr = <T>(v: unknown, f: (x: unknown) => T): T[] => (Array.isArray(v) ? v.map(f) : [])

/** Coerce whatever the model returned into the content shape, never throwing. */
export function normalize(raw: unknown): StoryContent {
  const o = (raw ?? {}) as Record<string, unknown>
  const bn = (o.big_number ?? {}) as Record<string, unknown>
  const tn = (o.then_now ?? {}) as Record<string, unknown>
  const glossary = o.glossary && typeof o.glossary === 'object' ? (o.glossary as Record<string, string>) : undefined
  return {
    kicker: str(o.kicker),
    headline: str(o.headline),
    dek: str(o.dek),
    body: arr(o.body, str).filter(Boolean),
    big_number: { fact_id: str(bn.fact_id), value: str(bn.value), caption: str(bn.caption) },
    key_points: arr(o.key_points, str).filter(Boolean),
    qa: arr(o.qa, (x) => ({ q: str((x as Record<string, unknown>)?.q), a: str((x as Record<string, unknown>)?.a) })),
    then_now: { then_label: str(tn.then_label), then_text: str(tn.then_text), now_label: str(tn.now_label), now_text: str(tn.now_text) },
    timeline: arr(o.timeline, (x) => ({ year: str((x as Record<string, unknown>)?.year), text: str((x as Record<string, unknown>)?.text) })),
    slides: arr(o.slides, (x) => {
      const s = (x ?? {}) as Record<string, unknown>
      return { kicker: str(s.kicker), headline: str(s.headline), body: str(s.body), fact_id: str(s.fact_id) || undefined }
    }),
    chart_title: str(o.chart_title),
    chart_subtitle: str(o.chart_subtitle),
    alt_text: str(o.alt_text),
    caveat: str(o.caveat),
    facts_used: arr(o.facts_used, str),
    glossary,
  }
}

/** Every piece of text a reader could see, labelled for the fact-check report. */
export function pieces(c: StoryContent): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [
    { where: 'headline', text: c.headline },
    { where: 'dek', text: c.dek },
    ...c.body.map((t, i) => ({ where: `paragraph ${i + 1}`, text: t })),
    { where: 'big number', text: `${c.big_number.value}. ${c.big_number.caption}` },
    ...c.key_points.map((t, i) => ({ where: `key point ${i + 1}`, text: t })),
    ...c.qa.flatMap((x, i) => [
      { where: `Q&A ${i + 1} question`, text: x.q },
      { where: `Q&A ${i + 1} answer`, text: x.a },
    ]),
    { where: 'then', text: c.then_now.then_text },
    { where: 'now', text: c.then_now.now_text },
    ...c.timeline.map((t, i) => ({ where: `timeline ${i + 1}`, text: `${t.year}: ${t.text}` })),
    ...c.slides.flatMap((s, i) => [{ where: `slide ${i + 1}`, text: [s.headline, s.body].filter(Boolean).join('. ') }]),
    { where: 'chart title', text: c.chart_title },
    { where: 'chart subtitle', text: c.chart_subtitle },
    { where: 'alt text', text: c.alt_text },
    { where: 'caveat', text: c.caveat },
  ]
  return out.filter((p) => p.text.trim())
}
