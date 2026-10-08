// FactBook: the only way a number enters a story. Each fact carries its full-precision
// value and the house-style strings (EN and Malayalam) writers must copy.
import { fmtPct, fmtRatio, fmtValue, mlOrdinal, mlPct, mlRatio, mlValue, ordinal, parseUnit } from './format'
import type { Assertion, Fact, Roles } from './types'

export class FactBook {
  readonly facts: Fact[] = []
  readonly assertions: Assertion[] = []

  readonly roles: Roles

  constructor(roles: Roles) {
    this.roles = roles
  }

  private add(f: Omit<Fact, 'id'>): Fact {
    const dup = this.facts.find((x) => x.kind === f.kind && x.label === f.label)
    if (dup) return dup
    const fact = { ...f, id: `F${this.facts.length + 1}` }
    this.facts.push(fact)
    return fact
  }

  unitOf(col: string): string {
    return this.roles.units[col] ?? ''
  }

  labelOf(col: string): string {
    return this.roles.labels[col] ?? col
  }

  /** A measured value straight from the file. */
  value(entity: string, period: number, col: string, v: number): Fact {
    const unit = this.unitOf(col)
    return this.add({
      kind: 'value',
      label: `${entity}, ${this.labelOf(col)}, ${period}`,
      value: v,
      unit,
      scale: parseUnit(unit).scale,
      en: fmtValue(v, unit),
      ml: mlValue(v, unit),
      entity,
      period,
    })
  }

  /** A computed amount in a column's unit (totals, differences, averages). */
  amount(label: string, v: number, col: string, entity?: string, period?: number): Fact {
    const unit = this.unitOf(col)
    return this.add({ kind: 'value', label, value: v, unit, scale: parseUnit(unit).scale, en: fmtValue(v, unit), ml: mlValue(v, unit), entity, period })
  }

  pct(label: string, p: number, entity?: string, period?: number): Fact {
    return this.add({ kind: 'pct', label, value: p, unit: '%', scale: 1, en: fmtPct(p), ml: mlPct(p), entity, period })
  }

  ratio(label: string, r: number, entity?: string): Fact {
    return this.add({ kind: 'ratio', label, value: r, unit: 'times', scale: 1, en: fmtRatio(r), ml: mlRatio(r), entity })
  }

  rank(label: string, n: number, entity?: string, period?: number): Fact {
    return this.add({ kind: 'rank', label, value: n, unit: '', scale: 1, en: ordinal(n), ml: mlOrdinal(n), entity, period })
  }

  count(label: string, n: number): Fact {
    return this.add({ kind: 'count', label, value: n, unit: '', scale: 1, en: String(n), ml: String(n) })
  }

  year(label: string, y: number, entity?: string): Fact {
    return this.add({ kind: 'year', label, value: y, unit: '', scale: 1, en: String(y), ml: String(y), entity, period: y })
  }

  assert(text: string, holds: boolean, detail: string): Assertion {
    const a = { id: `A${this.assertions.length + 1}`, text, holds, detail }
    this.assertions.push(a)
    return a
  }
}
