// Port of data-intake/scripts/profile.py: guess the shape of the file and write a data card.
import { median, num, Panel, quantile } from './data'
import { fmtValue } from './format'
import type { Codebook, DataCard, Dataset, Roles } from './types'

const TIME_NAME = /(^|_)(year|yr|date|month|period|quarter|time)($|_)/i
const TOTAL_WORDS = /\b(total|world|all|overall|sum|aggregate|average|other)\b/i
const ENTITY_NAME = /country|state|county|district|city|region|name|entity|area|place/i
const RATE_NAME = /per_?cap|per_?person|per_?head|per_?1000|per_?100/i
const SIZE_NAME = /^pop(ulation)?$/i
const OUTPUT_NAME = /^(gdp|gva|output)$/i

export function cleanUnit(u?: string): string {
  return (u ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim()
}

function fill(ds: Dataset, c: string): number {
  let n = 0
  for (const r of ds.rows) if (r[c] !== null) n++
  return ds.rows.length ? n / ds.rows.length : 0
}

function distinct(ds: Dataset, c: string): number {
  return new Set(ds.rows.map((r) => r[c]).filter((v) => v !== null)).size
}

export function guessTime(ds: Dataset): string | null {
  for (const c of ds.columns) if (TIME_NAME.test(c)) return c
  for (const c of ds.columns) {
    if (!ds.numeric.has(c)) continue
    const vs = ds.rows.map((r) => num(r[c])).filter((v): v is number => v !== null)
    if (vs.length && vs.every((v) => Number.isInteger(v) && v >= 1800 && v <= 2100) && new Set(vs).size > 1) return c
  }
  return null
}

export function guessEntity(ds: Dataset, time: string | null): string | null {
  let best: string | null = null
  let bestScore = 0
  for (const c of ds.columns) {
    if (c === time || ds.numeric.has(c)) continue
    const n = distinct(ds, c)
    if (n < 2) continue
    const repeat = ds.rows.length / Math.max(n, 1)
    let score = time ? repeat : n < ds.rows.length ? 1 / repeat : 0
    score *= ENTITY_NAME.test(c) ? 2 : 1
    if (score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return best
}

/** Largest of 1, 2, 5 x 10^k that is <= x. */
export function niceFloor(x: number): number {
  if (x <= 0) return 0
  const k = Math.floor(Math.log10(x))
  for (const m of [5, 2, 1]) if (m * 10 ** k <= x) return m * 10 ** k
  return 10 ** k
}

export function detectRoles(ds: Dataset, cb: Codebook = {}, source = ''): Roles | null {
  const time = guessTime(ds)
  const entity = guessEntity(ds, time)
  if (!time || !entity) return null
  const nums = ds.columns.filter((c) => ds.numeric.has(c) && c !== time)
  const size = nums.find((c) => SIZE_NAME.test(c)) ?? null
  const isAux = (c: string) =>
    c === size || RATE_NAME.test(c) || /share|_per_|percent|pct|index|rank/i.test(c) || OUTPUT_NAME.test(c) || /consumption/i.test(c)
  const candidates = nums.filter((c) => !isAux(c))
  candidates.sort((a, b) => fill(ds, b) - fill(ds, a) || a.length - b.length)
  const value = candidates[0]
  if (!value) return null
  const rate = nums.find((c) => RATE_NAME.test(c) && c.includes(value) && !/consumption/i.test(c)) ?? nums.find((c) => RATE_NAME.test(c) && !/consumption/i.test(c)) ?? null
  const consumption = nums.find((c) => /consumption/i.test(c) && c.includes(value) && !RATE_NAME.test(c)) ?? null
  const output = nums.find((c) => OUTPUT_NAME.test(c)) ?? null

  const exclude = [...new Set(ds.rows.map((r) => r[entity]).filter((v) => v !== null).map(String))].filter((v) => TOTAL_WORDS.test(v))
  const panel = new Panel(ds, entity, time, exclude)
  const counts = panel.periods.map((t) => panel.at(t, value).size)
  const maxCount = Math.max(...counts)
  const base = panel.periods[counts.findIndex((n) => n >= 0.9 * maxCount)]
  let latestIdx = counts.length - 1
  while (latestIdx > 0 && counts[latestIdx] < 0.9 * counts[latestIdx - 1]) latestIdx--
  const latest = panel.periods[latestIdx]

  const ranked = [...panel.at(latest, value).values()].sort((a, b) => b - a)
  const minValue = ranked.length > 40 ? niceFloor(ranked[39]) : 0
  const label = (c: string | null) => (c ? cb[c]?.title ?? c.replace(/_/g, ' ') : '')

  return {
    entity,
    time,
    value,
    rate,
    size,
    consumption,
    output,
    unit: cleanUnit(cb[value]?.unit),
    rateUnit: rate ? cleanUnit(cb[rate]?.unit) : '',
    valueLabel: label(value),
    rateLabel: label(rate),
    outputLabel: label(output),
    exclude,
    units: Object.fromEntries(ds.columns.map((c) => [c, cleanUnit(cb[c]?.unit)])),
    labels: Object.fromEntries(ds.columns.map((c) => [c, label(c)])),
    minSize: size ? 1_000_000 : 0,
    minValue,
    base,
    latest,
    source: source || cb[value]?.source || '',
  }
}

function fmtCell(v: number): string {
  if (Math.abs(v) >= 1e6) return Math.round(v).toLocaleString('en-US')
  if (Math.abs(v) >= 100) return v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return Number(v.toPrecision(3)).toLocaleString('en-US', { maximumFractionDigits: 6 })
}

export function buildCard(ds: Dataset, roles: Roles, cb: Codebook = {}): DataCard {
  const { entity, time } = roles
  const keys = new Set<string>()
  let dupKeys = 0
  const exact = new Set<string>()
  let exactDup = 0
  const perEntity = new Map<string, Set<number>>()
  const allPeriods = new Set<number>()
  for (const r of ds.rows) {
    const k = `${r[entity]}\u0000${r[time]}`
    if (keys.has(k)) dupKeys++
    keys.add(k)
    const full = JSON.stringify(ds.columns.map((c) => r[c]))
    if (exact.has(full)) exactDup++
    exact.add(full)
    const t = num(r[time])
    if (r[entity] !== null && t !== null) {
      const e = String(r[entity])
      if (!perEntity.has(e)) perEntity.set(e, new Set())
      perEntity.get(e)!.add(t)
      allPeriods.add(t)
    }
  }
  const nPeriods = allPeriods.size
  const complete = [...perEntity.values()].filter((s) => s.size === nPeriods).length
  const periods = [...allPeriods].sort((a, b) => a - b)

  const columns = ds.columns.map((c) => {
    const vs = ds.rows.map((r) => r[c]).filter((v) => v !== null)
    const isNum = ds.numeric.has(c)
    const ns = isNum ? (vs as number[]) : []
    let mn = Infinity
    let mx = -Infinity
    for (const v of ns) {
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
    return {
      name: c,
      kind: isNum ? 'number' : 'text',
      filled: ds.rows.length ? vs.length / ds.rows.length : 0,
      distinct: new Set(vs).size,
      min: isNum && ns.length ? mn : undefined,
      max: isNum && ns.length ? mx : undefined,
      unit: cb[c]?.unit ?? 'check',
    }
  })

  const flags: string[] = []
  for (const col of columns) {
    const miss = 1 - col.filled
    if (miss > 0.5) flags.push(`\`${col.name}\` is ${Math.round(miss * 100)}% empty. Use it with care or not at all.`)
    else if (miss > 0.1) flags.push(`\`${col.name}\` is ${Math.round(miss * 100)}% empty. Check whether gaps cluster in certain years or places.`)
    if (col.distinct === 1) flags.push(`\`${col.name}\` has a single value everywhere.`)
    if (col.kind === 'number') {
      const neg = ds.rows.filter((r) => (num(r[col.name]) ?? 0) < 0).length
      if (neg) flags.push(`\`${col.name}\` has ${neg.toLocaleString('en-US')} negative values. Fine for changes or balances, suspicious for counts or totals.`)
    }
  }
  if (roles.exclude.length) {
    const shown = roles.exclude.slice(0, 8).join(', ') + (roles.exclude.length > 8 ? ' ...' : '')
    flags.push(`\`${entity}\` contains values that look like totals or groups (${shown}). Exclude them before ranking.`)
  }

  // One-period spikes: more than 3x the entity's median, in the top quarter of the column,
  // and neither neighbouring period also high (that would be growth or a level shift).
  const order = ds.rows
    .map((r, i) => ({ r, i, e: r[entity] === null ? '' : String(r[entity]), t: num(r[time]) ?? 0 }))
    .sort((a, b) => (a.e < b.e ? -1 : a.e > b.e ? 1 : a.t - b.t))
  const spikesAll: { ratio: number; column: string; entity: string; period: number; value: number }[] = []
  for (const c of ds.columns) {
    if (c === time || !ds.numeric.has(c)) continue
    const byE = new Map<string, number[]>()
    for (const { r, e } of order) {
      const v = num(r[c])
      if (v === null) continue
      if (!byE.has(e)) byE.set(e, [])
      byE.get(e)!.push(v)
    }
    const med = new Map([...byE].map(([e, vs]) => [e, median(vs)]))
    const colVals = ds.rows.map((r) => num(r[c])).filter((v): v is number => v !== null)
    if (!colVals.length) continue
    const q75 = quantile(colVals, 0.75)
    const hi = order.map(({ r, e }) => {
      const v = num(r[c])
      const m = med.get(e)
      return v !== null && m !== undefined && m > 0 && v / m > 3
    })
    const hits: typeof spikesAll = []
    order.forEach(({ r, e, t }, k) => {
      if (!hi[k]) return
      const prevHi = k > 0 && order[k - 1].e === e && hi[k - 1]
      const nextHi = k < order.length - 1 && order[k + 1].e === e && hi[k + 1]
      const v = num(r[c])!
      if (prevHi || nextHi || v < q75) return
      hits.push({ ratio: v / med.get(e)!, column: c, entity: e, period: t, value: v })
    })
    hits.sort((a, b) => b.ratio - a.ratio)
    spikesAll.push(...hits.slice(0, 2))
  }
  const seen = new Set<string>()
  const spikes = spikesAll
    .sort((a, b) => b.ratio - a.ratio)
    .filter((s) => {
      const k = `${s.column}|${s.entity}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, 4)
  for (const s of spikes)
    flags.push(`One-period spike: \`${s.column}\` for ${s.entity} in ${s.period} is ${fmtCell(s.value)}, ${s.ratio.toFixed(1)} times its usual level. Check whether it is a real event or an error.`)

  const pop = ds.columns.find((c) => SIZE_NAME.test(c))
  if (pop) {
    for (const c of ds.columns) {
      if (!RATE_NAME.test(c) || !ds.numeric.has(c)) continue
      let top: (typeof ds.rows)[number] | null = null
      for (const r of ds.rows) {
        const v = num(r[c])
        if (v !== null && (top === null || v > (num(top[c]) ?? -Infinity))) top = r
      }
      const p = top ? num(top[pop]) : null
      if (top && p !== null && p < 1_000_000)
        flags.push(
          `The highest \`${c}\` belongs to ${top[entity]} (population ${Math.round(p).toLocaleString('en-US')}). Small places swing per-person rankings; set a population floor before ranking.`,
        )
    }
  }
  const latest = periods[periods.length - 1]
  const prev = periods[periods.length - 2]
  if (prev !== undefined) {
    const cl = ds.rows.filter((r) => num(r[time]) === latest).length
    const cp = ds.rows.filter((r) => num(r[time]) === prev).length
    if (cl < 0.9 * cp) flags.push(`The latest period (${latest}) covers fewer entities (${cl}) than the one before (${cp}). It may be provisional.`)
  }

  return {
    file: ds.name,
    rows: ds.rows.length,
    columnCount: ds.columns.length,
    entities: perEntity.size,
    periods: { first: periods[0], last: latest, count: nPeriods },
    uniqueKeys: dupKeys === 0,
    duplicateKeyRows: dupKeys,
    exactDuplicates: exactDup,
    completeEntities: complete,
    gappedEntities: perEntity.size - complete,
    columns,
    flags,
    spikes,
    definitions: ds.columns.filter((c) => cb[c]?.description).map((c) => ({ column: c, text: cb[c].description!.slice(0, 220) })),
  }
}

export function describeSpike(s: DataCard['spikes'][number], unit: string): string {
  return `${s.entity} ${s.period}: ${fmtValue(s.value, unit)} (${s.ratio.toFixed(1)} times its usual level)`
}
