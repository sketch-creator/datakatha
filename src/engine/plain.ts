// Plain-English text written by code, for any file, with or without the AI.
// Audience: non-technical reporters, editors and readers.
import type { Analysis } from './types'

const plural = (entity: string, n: number) => {
  const e = entity.replace(/_/g, ' ')
  if (n === 1) return e
  if (/y$/.test(e) && !/[aeiou]y$/.test(e)) return e.replace(/y$/, 'ies')
  return /s$/.test(e) ? e : `${e}s`
}

/** Codebook titles in everyday words: "Annual CO₂ emissions per capita" -> "CO₂ emissions per person". */
export function friendly(label: string): string {
  let t = label.replace(/^annual\s+/i, '').replace(/per[ -]capita/gi, 'per person').replace(/\(([^)]*)\)/g, '').trim()
  t = t.replace(/^(per person )?consumption-based\s+(.*)$/i, (_, pp, rest) => `${rest}${pp ? ' per person' : ''} counting imports`).replace(/\bterritorial\s+/i, '')
  if (/^[A-Z][a-z]/.test(t)) t = t[0].toLowerCase() + t.slice(1)
  return t
}

export function plainSummary(a: Analysis): string {
  const c = a.card
  const r = a.roles
  const what = friendly(r.valueLabel || r.value.replace(/_/g, ' '))
  const per = r.rate ? ` It also gives the same figure per person${r.rateUnit ? ` (in ${r.rateUnit.replace(/ per person$/, '')})` : ''}.` : ''
  return `This data shows ${what}${r.unit ? ` (in ${r.unit})` : ''} for ${c.entities.toLocaleString('en-US')} ${plural(r.entity, c.entities)}, every ${r.time.replace(/_/g, ' ')} from ${c.periods.first} to ${c.periods.last}.${per}${r.source ? ` It comes from ${r.source}.` : ''}`
}

export function plainNotes(a: Analysis): string[] {
  const notes: string[] = []
  const r = a.roles
  const label = (col: string) => friendly(r.labels[col] ?? col.replace(/_/g, ' '))
  const spike = a.card.spikes.find((s) => s.column === r.rate || s.column === r.value) ?? a.card.spikes[0]
  if (spike)
    notes.push(
      `${spike.entity}'s ${label(spike.column)} in ${spike.period} is about ${Math.floor(spike.ratio)} times its normal level. It could be a real one-off event or a mistake, so check it before using that year.`,
    )
  if (r.rate && r.size && a.card.flags.some((f) => /Small places/.test(f)))
    notes.push(`Very small places can top per-person lists. Per-person rankings here only include places with at least ${r.minSize.toLocaleString('en-US')} people.`)
  const gappy = a.card.columns.filter((c) => c.filled < 0.6 && c.name !== r.entity).map((c) => label(c.name))
  if (gappy.length) notes.push(`Some figures have big gaps (${gappy.slice(0, 2).join(', ')}${gappy.length > 2 ? ' and others' : ''}). Stories that use them say which years they cover.`)
  if (a.card.flags.some((f) => /may be provisional/.test(f))) notes.push(`The latest year covers fewer places than the year before. It may be an early estimate.`)
  if (r.exclude.length) notes.push(`Totals and groups such as ${r.exclude.slice(0, 2).join(' and ')} were left out of the rankings so they don't count twice.`)
  return notes.slice(0, 3)
}
