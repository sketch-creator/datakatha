// Port of story-finder/scripts/find_angles.py: the seven standard newsroom checks.
// Each check returns a Story with its own fact book, assertions and chart.
import { mean, Panel, sortedEntries, std } from './data'
import { FactBook } from './facts'
import { fmtPct, fmtRatio, fmtValue } from './format'
import type { ChartSpec, Roles, Story, StoryKind } from './types'

export interface Ctx {
  panel: Panel
  roles: Roles
}

export type Draft = Omit<Story, 'id'>

export const pctChange = (a: number, b: number) => ((b - a) / a) * 100

export function short(label: string): string {
  return label.replace(/^annual\s+/i, '')
}

export function chartBase(ctx: Ctx, c: Partial<ChartSpec> & Pick<ChartSpec, 'type' | 'title' | 'subtitle' | 'yLabel' | 'unit'>): ChartSpec {
  return { source: ctx.roles.source ? `Source: ${ctx.roles.source}` : 'Source: uploaded data', ...c }
}

export function draft(
  kind: StoryKind,
  book: FactBook,
  d: Omit<Draft, 'kind' | 'facts' | 'assertions' | 'hidden'> & { hidden?: boolean },
): Draft {
  return { kind, hidden: d.hidden ?? false, facts: book.facts, assertions: book.assertions, ...d }
}

function list(xs: string[]): string {
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

/** Change table between base and latest for entities at or above minValue in the latest period. */
export function changeTable(ctx: Ctx, col: string, base: number, latest: number) {
  const { panel, roles } = ctx
  const b = panel.at(base, col)
  const l = panel.at(latest, col)
  const rows: { e: string; base: number; latest: number; abs: number; pct: number; ratio: number }[] = []
  for (const [e, lv] of l) {
    const bv = b.get(e)
    if (bv === undefined || !(bv > 0) || lv < roles.minValue) continue
    rows.push({ e, base: bv, latest: lv, abs: lv - bv, pct: pctChange(bv, lv), ratio: lv / bv })
  }
  return rows
}

export function standardChecks(ctx: Ctx): { stories: Draft[]; log: { name: string; result: string }[] } {
  const { panel, roles } = ctx
  const V = roles.value
  const { base, latest } = roles
  const u = roles.unit
  const vLabel = short(roles.valueLabel)
  const stories: Draft[] = []
  const log: { name: string; result: string }[] = []

  // 1. Leaders and concentration
  const lv = sortedEntries(panel.at(latest, V))
  const total = lv.reduce((a, [, v]) => a + v, 0)
  const top5 = lv.slice(0, 5)
  const share5 = (top5.reduce((a, [, v]) => a + v, 0) / total) * 100
  {
    const book = new FactBook(roles)
    const fShare = book.pct(`Share of the ${latest} total held by the five largest`, share5, undefined, latest)
    top5.forEach(([e, v]) => book.value(e, latest, V, v))
    book.amount(`Total ${vLabel} across all ${lv.length} entities in the file, ${latest}`, total, V, undefined, latest)
    book.count('Entities in the file with a value in the latest year', lv.length)
    book.count('Number of largest entities in the share', 5)
    stories.push(
      draft('leaders', book, {
        title: `Five places account for ${fShare.en} of the ${latest} total`,
        finding: `${list(top5.map(([e]) => e))} together produced ${fShare.en} of all ${vLabel} in the file in ${latest}.`,
        method: `Sum of the five largest in ${latest} divided by the sum for all ${lv.length} entities in the file.`,
        checkBeforeUse: "Does the file total match the publisher's own world or national total? Aggregates excluded?",
        entities: top5.map(([e]) => e),
        chart: chartBase(ctx, {
          type: 'bar',
          title: `The five largest produce ${fShare.en} of the total`,
          subtitle: `${vLabel}, ${u}, ${latest}`,
          yLabel: u,
          unit: u,
          bars: lv.slice(0, 10).map(([e, v], i) => ({ label: e, value: v, highlight: i < 5 })),
        }),
        score: 0.7,
      }),
    )
    log.push({ name: 'Leaders and concentration', result: `top five = ${fmtPct(share5)} of the ${latest} file total (${lv.length} entities)` })
  }

  // 2. Change between base and latest
  const j = changeTable(ctx, V, base, latest)
  if (j.length) {
    const rise = [...j].sort((a, b) => b.ratio - a.ratio).slice(0, 5)
    const fall = [...j].sort((a, b) => a.ratio - b.ratio).slice(0, 5)
    const r0 = rise[0]
    {
      const book = new FactBook(roles)
      book.value(r0.e, base, V, r0.base)
      book.value(r0.e, latest, V, r0.latest)
      const fr = book.ratio(`${r0.e}, ${vLabel} ${latest} as a multiple of ${base}`, r0.ratio, r0.e)
      book.pct(`${r0.e}, change in ${vLabel}, ${base} to ${latest}`, r0.pct, r0.e)
      rise.slice(1).forEach((r) => book.ratio(`${r.e}, ${vLabel} ${latest} as a multiple of ${base}`, r.ratio, r.e))
      book.count(`Entities with at least ${fmtValue(roles.minValue, u)} in ${latest}`, j.length)
      book.year('Base year', base)
      book.year('Latest year', latest)
      stories.push(
        draft('rise', book, {
          title: `${r0.e}'s ${vLabel} grew ${fr.en} since ${base}`,
          finding: `${r0.e} went from ${fmtValue(r0.base, u)} in ${base} to ${fmtValue(r0.latest, u)} in ${latest}, ${fmtRatio(r0.ratio)} as much.`,
          method: `${vLabel} ${latest} divided by ${base}, among the ${j.length} entities with at least ${fmtValue(roles.minValue, u)} in ${latest}.`,
          checkBeforeUse: 'Was the base year unusual (a recession, war, boundary change)? Does the ranking hold with a different base year?',
          entities: rise.map((r) => r.e),
          chart: chartBase(ctx, {
            type: 'bar',
            title: `${r0.e} grew fastest since ${base}`,
            subtitle: `${vLabel}, ${latest} as a multiple of ${base}`,
            yLabel: `times its ${base} level`,
            unit: 'times',
            bars: rise.map((r, i) => ({ label: r.e, value: r.ratio, highlight: i === 0 })),
          }),
          score: 0.8,
        }),
      )
      log.push({ name: 'Biggest rises', result: `${r0.e} ${fmtRatio(r0.ratio)}; next ${rise.slice(1).map((r) => `${r.e} ${fmtRatio(r.ratio)}`).join(', ')}` })
    }
    {
      const f0 = fall[0]
      const book = new FactBook(roles)
      fall.forEach((r) => {
        book.value(r.e, base, V, r.base)
        book.value(r.e, latest, V, r.latest)
        book.pct(`${r.e}, change in ${vLabel}, ${base} to ${latest}`, r.pct, r.e)
      })
      book.year('Base year', base)
      book.year('Latest year', latest)
      stories.push(
        draft('fall', book, {
          title: `${f0.e} cut its ${vLabel} by ${fmtPct(Math.abs(f0.pct))} since ${base}`,
          finding: `The steepest falls since ${base}: ${fall.map((r) => `${r.e} ${fmtPct(r.pct)}`).join(', ')}.`,
          method: `(${latest} minus ${base}) divided by ${base}, same group as the rises.`,
          checkBeforeUse: 'Is the fall from policy and fuel switching, or from economic collapse, war or offshoring?',
          entities: fall.map((r) => r.e),
          chart: chartBase(ctx, {
            type: 'bar',
            title: `The steepest falls since ${base}`,
            subtitle: `Change in ${vLabel}, ${base} to ${latest}, %`,
            yLabel: '% change',
            unit: '%',
            bars: fall.map((r, i) => ({ label: r.e, value: r.pct, highlight: i < 3 })),
          }),
          score: 0.75,
        }),
      )
      log.push({ name: 'Biggest falls', result: fall.map((r) => `${r.e} ${fmtPct(r.pct)}`).join(', ') })
    }
    {
      const absTop = [...j].sort((a, b) => b.abs - a.abs).slice(0, 3)
      const net = j.reduce((a, r) => a + r.abs, 0)
      const book = new FactBook(roles)
      absTop.forEach((r) => {
        book.amount(`${r.e}, increase in ${vLabel}, ${base} to ${latest}`, r.abs, V, r.e)
        book.value(r.e, base, V, r.base)
        book.value(r.e, latest, V, r.latest)
      })
      const fShare = book.pct(`${absTop[0].e}'s share of the group's net change`, (absTop[0].abs / net) * 100, absTop[0].e)
      stories.push(
        draft('absolute', book, {
          title: `${absTop[0].e} added ${fmtValue(absTop[0].abs, u)} since ${base}, more than any other`,
          finding: `${absTop[0].e} alone accounts for ${fShare.en} of the net change across the group.`,
          method: `${latest} minus ${base}; share = the entity's increase divided by the sum of all changes in the group.`,
          checkBeforeUse: 'Percent and absolute rankings tell different stories. Say which one the headline uses.',
          entities: absTop.map((r) => r.e),
          chart: chartBase(ctx, {
            type: 'line',
            title: `${absTop[0].e} added the most since ${base}`,
            subtitle: `${vLabel}, ${u}, ${base}-${latest}`,
            yLabel: u,
            unit: u,
            series: absTop.map((r, i) => ({ name: r.e, highlight: i === 0, points: panel.series(r.e, V, base, latest) })),
          }),
          score: 0.65,
        }),
      )
      log.push({ name: 'Biggest absolute change', result: absTop.map((r) => `${r.e} +${fmtValue(r.abs, u)}`).join(', ') })
    }
    {
      const pcts = j.map((r) => r.pct)
      const m = mean(pcts)
      const s = std(pcts)
      const outl = j.filter((r) => Math.abs((r.pct - m) / s) > 2)
      if (outl.length) {
        const book = new FactBook(roles)
        outl.forEach((r) => book.pct(`${r.e}, change in ${vLabel}, ${base} to ${latest}`, r.pct, r.e))
        book.pct('Group average change', m)
        book.count('Number of outliers', outl.length)
        stories.push(
          draft('outliers', book, {
            title: `${outl.length} change${outl.length > 1 ? 's' : ''} stand far outside the group`,
            finding: `${outl.map((r) => `${r.e} ${fmtPct(r.pct, true)}`).join('; ')} against a group average of ${fmtPct(m, true)}.`,
            method: 'z-score of percent change within the group; more than 2 standard deviations.',
            checkBeforeUse: 'Outliers are often small bases. Check the base-year value before reporting the percent.',
            entities: outl.map((r) => r.e),
            chart: chartBase(ctx, {
              type: 'dot',
              title: 'Two changes stand far outside the group',
              subtitle: `Change in ${vLabel}, ${base} to ${latest}, %`,
              yLabel: '% change',
              unit: '%',
              bars: [...j].sort((a, b) => b.pct - a.pct).slice(0, 15).map((r) => ({ label: r.e, value: r.pct, highlight: outl.includes(r) })),
            }),
            score: 0.4,
          }),
        )
      }
      log.push({ name: 'Outliers (z > 2)', result: outl.length ? outl.map((r) => `${r.e} ${fmtPct(r.pct, true)}`).join(', ') : 'none' })
    }
  } else {
    log.push({ name: 'Change since base', result: 'no entity has both periods' })
  }

  // 3. Per-person gaps
  const R = roles.rate
  if (R) {
    const lr = sortedEntries(panel.at(latest, R)).filter(([e]) => !roles.size || (panel.get(e, latest, roles.size) ?? 0) >= roles.minSize)
    if (lr.length > 5) {
      const hi = lr.slice(0, 5)
      const lo = lr.slice(-5).reverse()
      const book = new FactBook(roles)
      hi.forEach(([e, v]) => book.value(e, latest, R, v))
      lo.forEach(([e, v]) => book.value(e, latest, R, v))
      const big = lr.filter(([e]) => (panel.get(e, latest, V) ?? -Infinity) >= roles.minValue)
      let gap = ''
      if (big.length > 1) {
        const [ge, gv] = big[0]
        const [le, lv2] = big[big.length - 1]
        book.value(ge, latest, R, gv)
        book.value(le, latest, R, lv2)
        const fr = book.ratio(`${ge} per person as a multiple of ${le}, ${latest}`, gv / lv2)
        gap = ` Among larger totals, ${ge} is at ${fmtValue(gv, roles.rateUnit)} and ${le} at ${fmtValue(lv2, roles.rateUnit)}, ${fr.en} as much.`
      }
      stories.push(
        draft('per-person-gap', book, {
          title: `Per person, ${hi[0][0]} is at ${fmtValue(hi[0][1], roles.rateUnit)}, ${lo[0][0]} at ${fmtValue(lo[0][1], '')}`,
          finding: `The highest ${short(roles.rateLabel)} is ${hi[0][0]} (${fmtValue(hi[0][1], roles.rateUnit)}), the lowest ${lo[0][0]} (${fmtValue(lo[0][1], roles.rateUnit)}).${gap}`,
          method: `${short(roles.rateLabel)} in ${latest}, ranked${roles.size ? `, places with at least ${roles.minSize.toLocaleString('en-US')} people` : ''}.`,
          checkBeforeUse: 'Per-person values for small places are volatile. Is the population figure from the same year?',
          entities: [hi[0][0], lo[0][0]],
          chart: chartBase(ctx, {
            type: 'bar',
            title: 'The widest per-person gaps',
            subtitle: `${short(roles.rateLabel)}, ${roles.rateUnit}, ${latest}`,
            yLabel: roles.rateUnit,
            unit: roles.rateUnit,
            bars: [...hi.map(([e, v]) => ({ label: e, value: v, highlight: true })), ...lo.slice().reverse().map(([e, v]) => ({ label: e, value: v }))],
          }),
          score: 0.55,
          perPerson: true,
        }),
      )
      log.push({ name: 'Per-person highs and lows', result: `${hi[0][0]} ${fmtValue(hi[0][1], '')} high, ${lo[0][0]} ${fmtValue(lo[0][1], '')} low` })
    }
  }

  // 4. Peaked and declining
  const bigEnts = j.length ? j.map((r) => r.e) : lv.map(([e]) => e)
  {
    const pk: { e: string; year: number; peak: number; latest: number; below: number }[] = []
    for (const e of bigEnts) {
      const s = panel.series(e, V)
      if (!s.length) continue
      let best = s[0]
      for (const p of s) if (p.y > best.y) best = p
      const lt = panel.get(e, latest, V)
      if (lt === null) continue
      pk.push({ e, year: best.x, peak: best.y, latest: lt, below: pctChange(best.y, lt) })
    }
    const peaked = pk.filter((p) => p.year < latest - 4 && p.below <= -20).sort((a, b) => a.below - b.below)
    if (peaked.length) {
      const book = new FactBook(roles)
      book.count('Larger entities at least 20% below their own peak', peaked.length)
      book.count('Larger entities in the group', bigEnts.length)
      peaked.slice(0, 6).forEach((p) => {
        book.pct(`${p.e}, latest ${vLabel} vs its peak`, p.below, p.e)
        book.year(`${p.e}, peak year`, p.year, p.e)
        book.value(p.e, p.year, V, p.peak)
      })
      stories.push(
        draft('peaked', book, {
          title: `${peaked.length} of the ${bigEnts.length} larger emitters are at least 20% below their own peak`,
          finding: peaked.slice(0, 6).map((p) => `${p.e} ${fmtPct(p.below)} (peak ${p.year})`).join('; '),
          method: `Latest ${vLabel} vs each entity's maximum since ${panel.periods[0]}.`,
          checkBeforeUse: "Peaks before the file's first year are invisible here. Check longer history before saying 'peaked'.",
          entities: peaked.slice(0, 6).map((p) => p.e),
          chart: chartBase(ctx, {
            type: 'line',
            title: 'Well below their own peaks',
            subtitle: `${vLabel}, ${u}`,
            yLabel: u,
            unit: u,
            series: peaked.slice(0, 4).map((p, i) => ({ name: p.e, highlight: i === 0, points: panel.series(p.e, V) })),
          }),
          score: 0.5,
        }),
      )
    }
    log.push({ name: 'Below own peak (20%+)', result: `${peaked.length} of ${bigEnts.length}` })
  }

  // 5. Turns in the latest year
  {
    const prev = latest - 1
    const turns: { e: string; yoy: number; trend: number }[] = []
    for (const e of bigEnts) {
      const lt = panel.get(e, latest, V)
      const pv = panel.get(e, prev, V)
      if (lt === null || pv === null) continue
      const s = panel.series(e, V, latest - 11, prev)
      const ch: number[] = []
      for (let i = 1; i < s.length; i++) ch.push(pctChange(s[i - 1].y, s[i].y))
      const finite = ch.filter((x) => Number.isFinite(x))
      if (!finite.length) continue
      const trend = mean(finite)
      const yoy = pctChange(pv, lt)
      if (yoy * trend < 0 && Math.abs(yoy) >= 3) turns.push({ e, yoy, trend })
    }
    turns.sort((a, b) => a.yoy - b.yoy)
    if (turns.length) {
      const book = new FactBook(roles)
      book.count(`Larger entities that moved against their 10-year trend in ${latest}`, turns.length)
      turns.slice(0, 6).forEach((t) => {
        book.pct(`${t.e}, change ${prev} to ${latest}`, t.yoy, t.e, latest)
        book.pct(`${t.e}, average yearly change over the previous 10 years`, t.trend, t.e)
      })
      stories.push(
        draft('turns', book, {
          title: `${turns.length} larger emitters moved against their 10-year trend in ${latest}`,
          finding: turns.slice(0, 6).map((t) => `${t.e} ${fmtPct(t.yoy, true)} in ${latest} vs ${fmtPct(t.trend, true)} a year before`).join('; '),
          method: `Change ${prev} to ${latest} vs the mean yearly change over the previous 10 years.`,
          checkBeforeUse: 'One year is not a trend. Is the latest year provisional or revised?',
          entities: turns.map((t) => t.e),
          chart: chartBase(ctx, {
            type: 'line',
            title: `Turning against the trend in ${latest}`,
            subtitle: `${vLabel}, ${u}`,
            yLabel: u,
            unit: u,
            series: turns.slice(0, 3).map((t, i) => ({ name: t.e, highlight: i === 0, points: panel.series(t.e, V, latest - 11, latest) })),
          }),
          score: 0.35,
        }),
      )
    }
    log.push({ name: 'Turns in the latest year', result: turns.length ? turns.map((t) => `${t.e} ${fmtPct(t.yoy, true)}`).join(', ') : 'none' })
  }

  // 7. Per-person crossovers among the largest emitters
  if (R) {
    let top = lv.slice(0, 10).map(([e]) => e)
    if (roles.size) top = top.filter((e) => (panel.get(e, latest, roles.size!) ?? 0) >= roles.minSize)
    const rb = panel.at(base, R)
    const rl = panel.at(latest, R)
    const swaps: [string, string][] = []
    for (const x of top)
      for (const y of top) {
        if (x === y) continue
        const bx = rb.get(x)
        const by = rb.get(y)
        const lx = rl.get(x)
        const ly = rl.get(y)
        if (bx === undefined || by === undefined || lx === undefined || ly === undefined) continue
        if (bx < by && lx > ly) swaps.push([x, y])
      }
    // A pair that still shows the same value at house-style precision is a tie, not a pass.
    const shown = (v: number) => fmtValue(v, '')
    const real = swaps.filter(([x, y]) => shown(rl.get(x)!) !== shown(rl.get(y)!))
    if (real.length) {
      const counts = new Map<string, number>()
      for (const [x] of real) counts.set(x, (counts.get(x) ?? 0) + 1)
      let lead = real[0][0]
      for (const [x, n] of counts) if (n > counts.get(lead)!) lead = x
      const ties = swaps.filter(([x, y]) => x === lead && shown(rl.get(x)!) === shown(rl.get(y)!)).map(([, y]) => y)
      const passed = real.filter(([x]) => x === lead).map(([, y]) => y)
      const book = new FactBook(roles)
      book.value(lead, base, R, rb.get(lead)!)
      const fLead = book.value(lead, latest, R, rl.get(lead)!)
      book.ratio(`${lead}, ${short(roles.rateLabel)} ${latest} as a multiple of ${base}`, rl.get(lead)! / rb.get(lead)!, lead)
      const years: string[] = []
      for (const y of passed) {
        book.value(y, base, R, rb.get(y)!)
        book.value(y, latest, R, rl.get(y)!)
        const cy = crossoverYear(panel, R, lead, y, latest)
        if (cy !== null) {
          book.year(`Year ${lead} passed ${y} per person (and stayed ahead)`, cy, lead)
          years.push(`${y} ${cy}`)
        }
        book.assert(
          `${lead} emits more per person than ${y} in ${latest}`,
          rl.get(lead)! > rl.get(y)!,
          `${fmtValue(rl.get(lead)!, '')} vs ${fmtValue(rl.get(y)!, '')}`,
        )
        book.assert(`${lead} emitted less per person than ${y} in ${base}`, rb.get(lead)! < rb.get(y)!, `${fmtValue(rb.get(lead)!, '')} vs ${fmtValue(rb.get(y)!, '')}`)
      }
      for (const y of ties) {
        book.value(y, latest, R, rl.get(y)!)
        book.assert(`${lead} and ${y} are level per person in ${latest} (same value when rounded)`, true, `${fmtValue(rl.get(lead)!, '')} vs ${fmtValue(rl.get(y)!, '')}`)
      }
      // Context the writer may need, and the trap a wrong headline falls into.
      const notPassed = top.filter((y) => y !== lead && !passed.includes(y) && (rl.get(y) ?? -1) > rl.get(lead)!)
      for (const y of notPassed.slice(0, 2)) {
        book.value(y, base, R, rb.get(y)!)
        book.value(y, latest, R, rl.get(y)!)
        book.assert(`${lead} still emits less per person than ${y} in ${latest}`, true, `${fmtValue(rl.get(lead)!, '')} vs ${fmtValue(rl.get(y)!, '')}`)
      }
      const lt = panel.get(lead, latest, V)
      const bt = panel.get(lead, base, V)
      if (lt !== null && bt !== null) {
        book.value(lead, latest, V, lt)
        book.ratio(`${lead}, ${vLabel} ${latest} as a multiple of ${base}`, lt / bt, lead)
      }
      const names = passed.slice(0, 3).join(', ').replace(/, ([^,]*)$/, ' or $1') + (passed.length > 3 ? ` and ${passed.length - 3} more` : '')
      stories.push(
        draft('crossover', book, {
          title: `${lead} now emits more per person than ${names}`,
          finding: `${lead} rose from ${fmtValue(rb.get(lead)!, '')} to ${fLead.en} between ${base} and ${latest}, passing ${list(passed)}${years.length ? ` (${years.join(', ')})` : ''}.`,
          method: `Pairs among the ${top.length} largest by total ${vLabel} where ${short(roles.rateLabel)} was lower in ${base} and higher in ${latest}; crossover year = first year it stayed ahead.`,
          checkBeforeUse: 'Per-person values use each year\'s population estimate. Does it hold with a different base year?',
          entities: [lead, ...passed],
          chart: chartBase(ctx, {
            type: 'line',
            title: `${lead} passed ${names} per person`,
            subtitle: `${short(roles.rateLabel)}, ${roles.rateUnit}, ${base}-${latest}`,
            yLabel: roles.rateUnit,
            unit: roles.rateUnit,
            series: [lead, ...passed].map((e) => ({ name: e, highlight: e === lead, points: panel.series(e, R, base, latest) })),
          }),
          score: 0.9,
          perPerson: true,
        }),
      )
      log.push({ name: 'Per-person crossovers (largest 10)', result: `${lead} passed ${list(passed)}${years.length ? ` (${years.join(', ')})` : ''}` })
    } else {
      log.push({ name: 'Per-person crossovers (largest 10)', result: 'none' })
    }
  }

  return { stories, log }
}

/** First year from which `a` stays above `b` through `latest`, or null. */
export function crossoverYear(panel: Panel, col: string, a: string, b: string, latest: number): number | null {
  let year: number | null = null
  for (let i = panel.periods.length - 1; i >= 0; i--) {
    const t = panel.periods[i]
    if (t > latest) continue
    const va = panel.get(a, t, col)
    const vb = panel.get(b, t, col)
    if (va === null || vb === null || !(va > vb)) break
    year = t
  }
  return year
}

