// A reporter's own angle, turned into a query by the model and answered by the engine.
import { chartBase, crossoverYear, pctChange, short } from './checks'
import { Panel, sortedEntries } from './data'
import { FactBook } from './facts'
import { fmtValue } from './format'
import type { Analysis, Story } from './types'

export interface AngleQuery {
  entities: string[]
  measure: 'value' | 'rate'
  kind: 'compare' | 'change' | 'rank' | 'crossover'
  base: number | null
  latest: number | null
  hypothesis: string
  feasible: boolean
  reason?: string
}

export function angleStory(a: Analysis, panel: Panel, q: AngleQuery, id: string): Story | null {
  const roles = a.roles
  const col = q.measure === 'rate' && roles.rate ? roles.rate : roles.value
  const known = new Set(panel.entities)
  const ents = q.entities.filter((e) => known.has(e)).slice(0, 6)
  if (!ents.length) return null
  const base = q.base && panel.periods.includes(q.base) ? q.base : roles.base
  const latest = q.latest && panel.periods.includes(q.latest) ? q.latest : roles.latest
  const book = new FactBook(roles)
  const rank = new Map(sortedEntries(panel.at(latest, col)).map(([e], i) => [e, i + 1]))
  for (const e of ents) {
    const b = panel.get(e, base, col)
    const l = panel.get(e, latest, col)
    if (b !== null) book.value(e, base, col, b)
    if (l !== null) book.value(e, latest, col, l)
    if (b !== null && l !== null && b > 0) {
      book.pct(`${e}, change in ${short(roles.labels[col] ?? col)}, ${base} to ${latest}`, pctChange(b, l), e)
      book.ratio(`${e}, ${short(roles.labels[col] ?? col)} ${latest} as a multiple of ${base}`, l / b, e)
    }
    if (rank.has(e)) book.rank(`${e}, rank by ${short(roles.labels[col] ?? col)}, ${latest}`, rank.get(e)!, e, latest)
  }
  for (let i = 0; i < ents.length; i++)
    for (let j = i + 1; j < ents.length; j++) {
      const x = ents[i]
      const y = ents[j]
      const lx = panel.get(x, latest, col)
      const ly = panel.get(y, latest, col)
      if (lx === null || ly === null) continue
      const [hi, lo, vh, vl] = lx >= ly ? [x, y, lx, ly] : [y, x, ly, lx]
      book.assert(`${hi} is higher than ${lo} on ${short(roles.labels[col] ?? col)} in ${latest}`, vh > vl, `${fmtValue(vh, '')} vs ${fmtValue(vl, '')}`)
      if (vl > 0) book.ratio(`${hi} as a multiple of ${lo}, ${short(roles.labels[col] ?? col)}, ${latest}`, vh / vl)
      const cy = crossoverYear(panel, col, hi, lo, latest)
      if (cy !== null && cy > panel.periods[0]) book.year(`Year ${hi} moved ahead of ${lo} (and stayed ahead)`, cy, hi)
    }
  book.year('Base year', base)
  book.year('Latest year', latest)
  const unit = roles.units[col] ?? ''
  return {
    id,
    kind: 'own-angle',
    hidden: false,
    title: q.hypothesis,
    finding: `Reporter's angle, tested on the data: ${q.hypothesis}`,
    method: `${short(roles.labels[col] ?? col)} for ${ents.join(', ')}, ${base} and ${latest}; comparisons recomputed for every pair.`,
    checkBeforeUse: 'This angle came from the reporter. The assertions show which parts the data supports; write only those.',
    entities: ents,
    facts: book.facts,
    assertions: book.assertions,
    chart: chartBase(
      { panel, roles },
      {
        type: 'line',
        title: q.hypothesis.slice(0, 60),
        subtitle: `${short(roles.labels[col] ?? col)}, ${unit}, ${base}-${latest}`,
        yLabel: unit,
        unit,
        series: ents.map((e, i) => ({ name: e, highlight: i === 0, points: panel.series(e, col, base, latest) })),
      },
    ),
    score: 1,
    perPerson: col === roles.rate,
  }
}
