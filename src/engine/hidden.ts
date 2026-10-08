// Deeper checks the standard story-finder does not run. Each returns a "hidden" lead
// with a line on why a reporter running the usual checks would miss it.
import { changeTable, chartBase, draft, pctChange, short, type Ctx, type Draft } from './checks'
import { sortedEntries } from './data'
import { FactBook } from './facts'
import { fmtPct, fmtValue, ordinal } from './format'

export function hiddenChecks(ctx: Ctx): { stories: Draft[]; log: { name: string; result: string }[] } {
  const { panel, roles } = ctx
  const V = roles.value
  const { base, latest } = roles
  const u = roles.unit
  const vLabel = short(roles.valueLabel)
  const stories: Draft[] = []
  const log: { name: string; result: string }[] = []
  const big = new Set([...panel.at(latest, V)].filter(([, v]) => v >= roles.minValue).map(([e]) => e))

  // H1. Imports-adjusted change: territorial vs consumption-based measure.
  if (roles.consumption) {
    const C = roles.consumption
    const cy = panel.lastPeriodWith(C)
    if (cy !== null && cy > base) {
      const rows: { e: string; terr: number; cons: number; gap: number }[] = []
      for (const e of big) {
        const tb = panel.get(e, base, V)
        const tl = panel.get(e, cy, V)
        const cb = panel.get(e, base, C)
        const cl = panel.get(e, cy, C)
        if (!tb || tl === null || !cb || cl === null) continue
        rows.push({ e, terr: pctChange(tb, tl), cons: pctChange(cb, cl), gap: pctChange(cb, cl) - pctChange(tb, tl) })
      }
      const fallers = rows.filter((r) => r.terr < 0 && r.gap > 5).sort((a, b) => b.gap - a.gap)
      if (fallers.length) {
        const lead = fallers[0]
        const book = new FactBook(roles)
        const show = fallers.slice(0, 5)
        for (const r of show) {
          book.pct(`${r.e}, change in ${vLabel} produced at home (territorial), ${base} to ${cy}`, r.terr, r.e)
          book.pct(`${r.e}, change in ${short(roles.labels[C] ?? C)} (counting imports), ${base} to ${cy}`, r.cons, r.e)
        }
        book.value(lead.e, cy, V, panel.get(lead.e, cy, V)!)
        book.value(lead.e, cy, C, panel.get(lead.e, cy, C)!)
        book.year('Latest year with consumption-based data', cy)
        book.year('Base year', base)
        book.count('Larger emitters whose fall shrinks when imports are counted', fallers.length)
        const flips = rows.filter((r) => r.terr < 0 && r.cons > 0)
        for (const f of flips) {
          book.pct(`${f.e}, change in ${vLabel} produced at home (territorial), ${base} to ${cy}`, f.terr, f.e)
          book.pct(`${f.e}, change in ${short(roles.labels[C] ?? C)} (counting imports), ${base} to ${cy}`, f.cons, f.e)
          book.assert(`${f.e}'s emissions fell at home but rose once imports are counted`, true, `${fmtPct(f.terr)} vs ${fmtPct(f.cons, true)}`)
        }
        stories.push(
          draft('imports', book, {
            hidden: true,
            title: `Counting imports, ${lead.e}'s ${vLabel} fell ${fmtPct(Math.abs(lead.cons))}, not ${fmtPct(Math.abs(lead.terr))}`,
            finding: `Between ${base} and ${cy}, ${lead.e}'s ${vLabel} made at home fell ${fmtPct(Math.abs(lead.terr))}. Counting what it imports, the fall is only ${fmtPct(Math.abs(lead.cons))}.${flips.length ? ` ${flips.map((f) => f.e).join(', ')}: down at home, up counting imports.` : ''}`,
            whyMissed: 'Most tables only count what a country makes at home. When you also count the things it buys from abroad, the cut looks smaller.',
            method: `Percent change ${base} to ${cy} in ${V} (territorial) and ${C} (consumption-based), for entities with at least ${fmtValue(roles.minValue, u)} in ${latest}.`,
            checkBeforeUse: `Consumption-based estimates are modelled and end in ${cy}. Say so, and do not mix their years with the territorial series.`,
            entities: show.map((r) => r.e),
            chart: chartBase(ctx, {
              type: 'grouped',
              title: `Counting imports shrinks the fall`,
              subtitle: `Change in ${vLabel}, ${base} to ${cy}, %`,
              yLabel: '% change',
              unit: '%',
              bars: show.flatMap((r) => [
                { label: r.e, value: r.terr, group: 'Produced at home' },
                { label: r.e, value: r.cons, group: 'Counting imports', highlight: true },
              ]),
            }),
            score: 0.85,
          }),
        )
      }
      log.push({ name: 'Imports-adjusted change (hidden)', result: fallers.length ? fallers.slice(0, 3).map((r) => `${r.e} ${fmtPct(r.terr)} vs ${fmtPct(r.cons)}`).join('; ') : 'none' })
    }
  }

  // H2. Decoupling: output up while the measure falls.
  if (roles.output) {
    const O = roles.output
    const gy = panel.lastPeriodWith(O)
    if (gy !== null && gy > base) {
      const rows: { e: string; out: number; val: number }[] = []
      for (const e of big) {
        const ob = panel.get(e, base, O)
        const ol = panel.get(e, gy, O)
        const vb = panel.get(e, base, V)
        const vl = panel.get(e, gy, V)
        if (!ob || ol === null || !vb || vl === null) continue
        rows.push({ e, out: pctChange(ob, ol), val: pctChange(vb, vl) })
      }
      const dec = rows.filter((r) => r.out > 0 && r.val < 0).sort((a, b) => b.out - b.val - (a.out - a.val))
      if (dec.length >= 2) {
        const book = new FactBook(roles)
        book.count(`Larger emitters whose ${short(roles.outputLabel)} grew while ${vLabel} fell, ${base} to ${gy}`, dec.length)
        book.count('Larger emitters with both series', rows.length)
        book.year(`Latest year with ${short(roles.outputLabel)} data`, gy)
        book.year('Base year', base)
        for (const r of dec.slice(0, 6)) {
          book.pct(`${r.e}, change in ${short(roles.outputLabel)}, ${base} to ${gy}`, r.out, r.e)
          book.pct(`${r.e}, change in ${vLabel}, ${base} to ${gy}`, r.val, r.e)
        }
        const lead = dec[0]
        const idx = (e: string, col: string) => {
          const b0 = panel.get(e, base, col)!
          return panel.series(e, col, base, gy).map((p) => ({ x: p.x, y: (p.y / b0) * 100 }))
        }
        stories.push(
          draft('decoupling', book, {
            hidden: true,
            title: `${dec.length} big emitters grew their economies while cutting ${vLabel}`,
            finding: `${dec.length} of ${rows.length} larger emitters grew ${short(roles.outputLabel)} and cut ${vLabel} between ${base} and ${gy}; ${lead.e}: ${fmtPct(lead.out, true)} vs ${fmtPct(lead.val)}.`,
            whyMissed: `People usually look at ${vLabel} on its own. Put it next to how much the economy grew, and some countries grew richer while polluting less.`,
            method: `Percent change ${base} to ${gy} in ${O} and ${V} for entities with at least ${fmtValue(roles.minValue, u)} in ${latest}.`,
            checkBeforeUse: `Economic collapse (e.g. after 1991) also cuts emissions; check each case. ${short(roles.outputLabel)} data ends in ${gy}.`,
            entities: dec.slice(0, 6).map((r) => r.e),
            chart: chartBase(ctx, {
              type: 'line',
              title: `${lead.e}: the economy grew, ${vLabel} fell`,
              subtitle: `Index, ${base} = 100`,
              yLabel: `index (${base} = 100)`,
              unit: 'index',
              series: [
                { name: `${short(roles.outputLabel)}`, highlight: false, points: idx(lead.e, O) },
                { name: `${vLabel}`, highlight: true, points: idx(lead.e, V) },
              ],
            }),
            score: 0.7,
          }),
        )
      }
      log.push({ name: 'Decoupling (hidden)', result: `${dec.length} of ${rows.length} grew output and cut ${vLabel}` })
    }
  }

  // H3. Rank climbers into the top 15 by total.
  {
    const rank = (t: number) => new Map(sortedEntries(panel.at(t, V)).map(([e], i) => [e, i + 1]))
    const rb = rank(base)
    const rl = rank(latest)
    const climbers = [...rl]
      .filter(([e, r]) => r <= 15 && rb.has(e))
      .map(([e, r]) => ({ e, from: rb.get(e)!, to: r, move: rb.get(e)! - r }))
      .filter((c) => c.move >= 5)
      .sort((a, b) => b.move - a.move)
    if (climbers.length) {
      const book = new FactBook(roles)
      for (const c of climbers.slice(0, 5)) {
        book.rank(`${c.e}, rank by total ${vLabel}, ${base}`, c.from, c.e, base)
        book.rank(`${c.e}, rank by total ${vLabel}, ${latest}`, c.to, c.e, latest)
        book.value(c.e, base, V, panel.get(c.e, base, V)!)
        book.value(c.e, latest, V, panel.get(c.e, latest, V)!)
      }
      book.count('Entities ranked', rl.size)
      const c0 = climbers[0]
      stories.push(
        draft('climbers', book, {
          hidden: true,
          title: `${c0.e} climbed from ${ordinal(c0.from)} to ${ordinal(c0.to)} largest emitter since ${base}`,
          finding: `Ranked by total ${vLabel}, ${climbers.slice(0, 4).map((c) => `${c.e} ${ordinal(c.from)} to ${ordinal(c.to)}`).join(', ')} between ${base} and ${latest}.`,
          whyMissed: 'Lists of the fastest growth favour countries that started tiny. A steady climb up the league table only shows when you compare positions.',
          method: `Rank of total ${vLabel} among all ${rl.size} entities in ${base} and ${latest}; climbers into the top 15 that rose five places or more.`,
          checkBeforeUse: 'Rank moves can come from others falling. Check the totals as well as the ranks.',
          entities: climbers.slice(0, 5).map((c) => c.e),
          chart: chartBase(ctx, {
            type: 'slope',
            title: `${c0.e} climbed the table`,
            subtitle: `Rank by total ${vLabel}, ${base} and ${latest} (1 = largest)`,
            yLabel: 'rank',
            unit: 'rank',
            invertY: true,
            series: climbers.slice(0, 5).map((c, i) => ({ name: c.e, highlight: i === 0, points: [{ x: base, y: c.from }, { x: latest, y: c.to }] })),
          }),
          score: 0.75,
        }),
      )
    }
    log.push({ name: 'Rank climbers (hidden)', result: climbers.length ? climbers.slice(0, 3).map((c) => `${c.e} ${c.from}→${c.to}`).join(', ') : 'none' })
  }

  // H4. Two camps: big emitters at a record in the latest year vs long past their peak.
  {
    const records: string[] = []
    const past: { e: string; year: number; below: number }[] = []
    for (const e of big) {
      const s = panel.series(e, V)
      if (!s.length) continue
      let best = s[0]
      for (const p of s) if (p.y >= best.y) best = p
      const lt = panel.get(e, latest, V)!
      if (best.x === latest) records.push(e)
      else if (best.x <= latest - 15) past.push({ e, year: best.x, below: pctChange(best.y, lt) })
    }
    past.sort((a, b) => a.year - b.year)
    if (records.length >= 3 && past.length >= 3) {
      const book = new FactBook(roles)
      book.count(`Larger emitters at their highest ${vLabel} in ${latest}`, records.length)
      book.count(`Larger emitters whose peak was ${latest - 15} or earlier`, past.length)
      book.count('Larger emitters in the group', big.size)
      book.year('Latest year', latest)
      for (const p of past.slice(0, 8)) {
        book.year(`${p.e}, peak year`, p.year, p.e)
        book.pct(`${p.e}, ${latest} vs its peak`, p.below, p.e)
      }
      for (const e of records.slice(0, 12)) book.value(e, latest, V, panel.get(e, latest, V)!)
      stories.push(
        draft('records-vs-peaks', book, {
          hidden: true,
          title: `${records.length} big emitters hit a record in ${latest}; ${past.length} peaked long ago`,
          finding: `${records.length} of ${big.size} larger emitters were at their highest in ${latest} (${records.slice(0, 5).join(', ')}...); ${past.length} peaked in ${latest - 15} or earlier (${past.slice(0, 4).map((p) => `${p.e} ${p.year}`).join(', ')}...).`,
          whyMissed: 'Looking at one country at a time hides the bigger picture: the big polluters have split into two groups, still rising and long past their peak.',
          method: `Year of each larger emitter's maximum ${vLabel} since ${panel.periods[0]}.`,
          checkBeforeUse: `Peaks before ${panel.periods[0]} are invisible in this file. A record in one provisional year can be revised.`,
          entities: [...records.slice(0, 3), ...past.slice(0, 3).map((p) => p.e)],
          chart: chartBase(ctx, {
            type: 'dot',
            title: 'Two camps of big emitters',
            subtitle: `Year of peak ${vLabel}, larger emitters`,
            yLabel: 'peak year',
            unit: 'year',
            bars: [
              ...records.slice(0, 8).map((e) => ({ label: e, value: latest, highlight: true })),
              ...past.slice(0, 8).map((p) => ({ label: p.e, value: p.year })),
            ],
          }),
          score: 0.72,
        }),
      )
    }
    log.push({ name: 'Records vs long-past peaks (hidden)', result: `${records.length} at a record in ${latest}; ${past.length} peaked by ${latest - 15}` })
  }

  // H5. Big in total, small per person.
  if (roles.rate && roles.size) {
    const R = roles.rate
    const S = roles.size
    const lv = sortedEntries(panel.at(latest, V))
    let num = 0
    let den = 0
    for (const [e, r] of panel.at(latest, R)) {
      const p = panel.get(e, latest, S)
      if (p !== null) {
        num += r * p
        den += p
      }
    }
    const avg = den ? num / den : null
    const top10 = lv.slice(0, 10)
    const cand = top10
      .map(([e, v], i) => ({ e, v, rank: i + 1, rate: panel.get(e, latest, R) }))
      .filter((c): c is { e: string; v: number; rank: number; rate: number } => c.rate !== null && avg !== null && c.rate < avg)
    if (cand.length && avg !== null) {
      const c0 = cand[0]
      const book = new FactBook(roles)
      book.rank(`${c0.e}, rank by total ${vLabel}, ${latest}`, c0.rank, c0.e, latest)
      book.value(c0.e, latest, V, c0.v)
      book.value(c0.e, latest, R, c0.rate)
      book.amount(`Population-weighted average ${short(roles.rateLabel)} across the file, ${latest}`, avg, R)
      book.pct(`${c0.e}'s per-person level as a share of that average`, (c0.rate / avg) * 100, c0.e)
      const topRate = top10.map(([e]) => ({ e, r: panel.get(e, latest, R) })).filter((x): x is { e: string; r: number } => x.r !== null).sort((a, b) => b.r - a.r)[0]
      if (topRate) {
        book.value(topRate.e, latest, R, topRate.r)
        book.ratio(`${topRate.e} per person as a multiple of ${c0.e}, ${latest}`, topRate.r / c0.rate)
      }
      book.assert(`${c0.e} emits less per person than the average`, true, `${fmtValue(c0.rate, '')} vs ${fmtValue(avg, '')}`)
      stories.push(
        draft('total-vs-per-person', book, {
          hidden: true,
          title: `${c0.e} is the ${ordinal(c0.rank)} biggest emitter, but below average per person`,
          finding: `${c0.e} ranks ${ordinal(c0.rank)} by total ${vLabel} (${fmtValue(c0.v, u)}) yet emits ${fmtValue(c0.rate, roles.rateUnit)}, below the average of ${fmtValue(avg, roles.rateUnit)}.`,
          whyMissed: 'Totals and per-person figures are usually reported separately. Side by side, they tell opposite stories about the same country.',
          method: `Rank of total ${vLabel} in ${latest}; average = sum of per-person value times population, divided by total population.`,
          checkBeforeUse: 'The average here covers the countries in this file, not an official world figure.',
          entities: [c0.e, ...(topRate ? [topRate.e] : [])],
          chart: chartBase(ctx, {
            type: 'bar',
            title: `Big total, small per person: ${c0.e}`,
            subtitle: `${short(roles.rateLabel)}, ${roles.rateUnit}, ${latest}, the 10 largest emitters`,
            yLabel: roles.rateUnit,
            unit: roles.rateUnit,
            bars: top10
              .map(([e]) => ({ label: e, value: panel.get(e, latest, R) ?? 0, highlight: e === c0.e }))
              .sort((a, b) => b.value - a.value),
          }),
          score: 0.68,
        }),
      )
    }
    log.push({ name: 'Big total, small per person (hidden)', result: cand.length ? cand.map((c) => `${c.e} (rank ${c.rank})`).join(', ') : 'none' })
  }

  // H6. Quiet risers: outside the top 10, the biggest absolute increase in the last decade.
  {
    const from = latest - 10
    if (panel.periods.includes(from)) {
      const top10 = new Set(sortedEntries(panel.at(latest, V)).slice(0, 10).map(([e]) => e))
      const rows = changeTable({ panel, roles: { ...roles, minValue: 0 } }, V, from, latest)
        .filter((r) => !top10.has(r.e))
        .sort((a, b) => b.abs - a.abs)
        .slice(0, 5)
      if (rows.length >= 3) {
        const book = new FactBook(roles)
        for (const r of rows) {
          book.amount(`${r.e}, increase in ${vLabel}, ${from} to ${latest}`, r.abs, V, r.e)
          book.pct(`${r.e}, change in ${vLabel}, ${from} to ${latest}`, r.pct, r.e)
          book.value(r.e, latest, V, r.latest)
        }
        book.year('Start of the decade', from)
        book.year('Latest year', latest)
        stories.push(
          draft('quiet-risers', book, {
            hidden: true,
            title: `Outside the top 10, ${rows[0].e} added the most ${vLabel} in a decade`,
            finding: `Since ${from}: ${rows.map((r) => `${r.e} +${fmtValue(r.abs, u)} (${fmtPct(r.pct, true)})`).join(', ')}.`,
            whyMissed: 'The news follows the biggest polluters. The fastest growth of the last ten years is happening just below them.',
            method: `${latest} minus ${from}, entities outside the ${latest} top 10.`,
            checkBeforeUse: 'Ten years is a short window; check it holds from a year either side.',
            entities: rows.map((r) => r.e),
            chart: chartBase(ctx, {
              type: 'line',
              title: 'The quiet risers',
              subtitle: `${vLabel}, ${u}, ${from}-${latest}`,
              yLabel: u,
              unit: u,
              series: rows.slice(0, 4).map((r, i) => ({ name: r.e, highlight: i === 0, points: panel.series(r.e, V, from, latest) })),
            }),
            score: 0.6,
          }),
        )
      }
      log.push({ name: 'Quiet risers outside the top 10 (hidden)', result: rows.map((r) => `${r.e} +${fmtValue(r.abs, '')}`).join(', ') || 'none' })
    }
  }

  return { stories, log }
}
