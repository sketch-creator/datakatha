import Papa from 'papaparse'
import type { Codebook, Dataset, Row } from './types'

export function parseCsv(text: string, name: string): Dataset {
  const res = Papa.parse<Row>(text.replace(/^﻿/, ''), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })
  const columns = (res.meta.fields ?? []).filter((c) => c !== '')
  const rows = res.data.map((r) => {
    const o: Row = {}
    for (const c of columns) {
      const v = r[c]
      o[c] = v === undefined || v === '' ? null : (v as Row[string])
    }
    return o
  })
  const numeric = new Set<string>()
  for (const c of columns) {
    let n = 0
    let filled = 0
    for (const r of rows) {
      const v = r[c]
      if (v === null) continue
      filled++
      if (typeof v === 'number' && Number.isFinite(v)) n++
    }
    if (filled > 0 && n / filled > 0.98) numeric.add(c)
  }
  return { name, columns, rows, numeric, sizeKB: Math.round(text.length / 1024) }
}

export function parseCodebook(text: string): Codebook {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy' })
  const cb: Codebook = {}
  for (const r of res.data) {
    const col = (r.column ?? r.Column ?? r.name ?? '').trim()
    if (!col) continue
    cb[col] = {
      title: r.title?.trim() || undefined,
      unit: r.unit?.trim() || undefined,
      description: r.description?.trim() || undefined,
      source: r.source?.trim() || undefined,
    }
  }
  return cb
}

export function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Panel view: entity -> period -> row, with helpers used by every check. */
export class Panel {
  readonly byEntity = new Map<string, Map<number, Row>>()
  readonly periods: number[]
  readonly ds: Dataset
  readonly entity: string
  readonly time: string

  constructor(ds: Dataset, entity: string, time: string, exclude: string[] = []) {
    this.ds = ds
    this.entity = entity
    this.time = time
    const ex = new Set(exclude)
    const ps = new Set<number>()
    for (const r of ds.rows) {
      const e = r[entity]
      const t = num(r[time])
      if (e === null || t === null) continue
      const key = String(e)
      if (ex.has(key)) continue
      let m = this.byEntity.get(key)
      if (!m) this.byEntity.set(key, (m = new Map()))
      m.set(t, r)
      ps.add(t)
    }
    this.periods = [...ps].sort((a, b) => a - b)
  }

  get entities(): string[] {
    return [...this.byEntity.keys()]
  }

  get(e: string, t: number, col: string): number | null {
    return num(this.byEntity.get(e)?.get(t)?.[col])
  }

  /** Values of `col` at period t for every entity that has one. */
  at(t: number, col: string): Map<string, number> {
    const out = new Map<string, number>()
    for (const [e, m] of this.byEntity) {
      const v = num(m.get(t)?.[col])
      if (v !== null) out.set(e, v)
    }
    return out
  }

  series(e: string, col: string, from = -Infinity, to = Infinity): { x: number; y: number }[] {
    const m = this.byEntity.get(e)
    if (!m) return []
    const pts: { x: number; y: number }[] = []
    for (const t of this.periods) {
      if (t < from || t > to) continue
      const v = num(m.get(t)?.[col])
      if (v !== null) pts.push({ x: t, y: v })
    }
    return pts
  }

  /** Latest period in which `col` has values for at least `share` of the entities that ever have it. */
  lastPeriodWith(col: string, share = 0.5): number | null {
    let ever = 0
    for (const m of this.byEntity.values()) {
      for (const r of m.values())
        if (num(r[col]) !== null) {
          ever++
          break
        }
    }
    for (let i = this.periods.length - 1; i >= 0; i--) {
      if (this.at(this.periods[i], col).size >= share * ever && ever > 0) return this.periods[i]
    }
    return null
  }
}

export function sortedEntries(m: Map<string, number>, desc = true): [string, number][] {
  return [...m.entries()].sort((a, b) => (desc ? b[1] - a[1] : a[1] - b[1]))
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Sample standard deviation (ddof=1), as pandas computes it. */
export function std(xs: number[]): number {
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

/** Linear-interpolated quantile, as pandas' default. */
export function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}
