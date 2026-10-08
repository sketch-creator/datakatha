// Draws an engine ChartSpec with Observable Plot, in the template's theme.
import { useEffect, useRef } from 'react'
import * as Plot from '@observablehq/plot'
import type { ChartSpec } from '@/engine'
import { fmtPct, group } from '@/engine/format'
import type { Theme } from '@/templates/themes'

export function fmtTick(v: number, unit: string): string {
  if (unit === '%') return fmtPct(v, true)
  if (unit === 'times') return `${group(v, 1)}×`
  if (unit === 'rank' || unit === 'year') return String(Math.round(v))
  if (unit === 'index') return group(v, 0)
  return Math.abs(v) >= 100 ? group(v, 0) : Math.abs(v) >= 0.1 ? group(v, 1) : group(v, 2)
}

export interface ChartProps {
  spec: ChartSpec
  theme: Theme
  width: number
  height: number
  /** For chart walk-throughs: how many series/bars to draw in full colour. */
  reveal?: number
  names?: Record<string, string>
  fontFamily?: string
  fontSize?: number
}

const NO_NAMES: Record<string, string> = {}

export function Chart({ spec, theme, width, height, reveal, names = NO_NAMES, fontFamily, fontSize = 12 }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const nm = (s: string) => names[s] ?? s
    const font = fontFamily ?? "'Inter Variable', 'Noto Sans Malayalam Variable', sans-serif"
    const style = { background: 'transparent', color: theme.ink, fontFamily: font, fontSize: `${fontSize}px`, overflow: 'visible' }
    const col = (hl: boolean | undefined, i: number) => {
      if (reveal !== undefined) return i < reveal ? (hl ? theme.accent : theme.accent2) : theme.context
      return hl ? theme.accent : theme.context
    }
    let chart: ReturnType<typeof Plot.plot>
    try {
      if ((spec.type === 'line' || spec.type === 'slope') && spec.series) {
        const series = spec.series.map((s, i) => ({ ...s, i }))
        const data = series.flatMap((s) => s.points.map((p) => ({ ...p, name: nm(s.name), color: col(s.highlight, s.i), w: s.highlight ? 3.2 : 1.8 })))
        const ends = series.map((s) => ({ ...s.points[s.points.length - 1], name: nm(s.name), color: col(s.highlight, s.i) })).filter((d) => d.x !== undefined)
        const starts = spec.type === 'slope' ? series.map((s) => ({ ...s.points[0], name: nm(s.name), color: col(s.highlight, s.i) })) : []
        const ys = data.map((d) => d.y)
        const minY = Math.min(...ys)
        chart = Plot.plot({
          width,
          height,
          style,
          marginRight: Math.min(170, 14 + Math.max(...ends.map((e) => e.name.length)) * fontSize * 0.58),
          marginLeft: spec.type === 'slope' ? Math.min(170, 14 + Math.max(...starts.map((e) => e.name.length), 3) * fontSize * 0.58) : 48,
          marginTop: 16,
          x: { tickFormat: 'd', label: null, ticks: spec.type === 'slope' ? data.map((d) => d.x).filter((v, i, a) => a.indexOf(v) === i) : Math.max(2, Math.floor(width / 110)), line: false },
          y: { grid: spec.type !== 'slope', label: null, reverse: spec.invertY, tickFormat: (v: number) => fmtTick(v, spec.unit), ticks: 5, axis: spec.type === 'slope' ? null : 'left', zero: !spec.invertY && minY >= 0 && spec.unit !== 'index' },
          marks: [
            Plot.lineY(data, { x: 'x', y: 'y', z: 'name', stroke: 'color', strokeWidth: 'w', curve: 'monotone-x' }),
            Plot.dot(ends, { x: 'x', y: 'y', fill: 'color', r: 3.5 }),
            Plot.text(ends, { x: 'x', y: 'y', text: (d: { name: string; y: number }) => (spec.type === 'slope' ? `${d.name} ${fmtTick(d.y, spec.unit)}` : d.name), dx: 8, textAnchor: 'start', fill: 'color', fontWeight: 600 }),
            ...(spec.type === 'slope'
              ? [
                  Plot.dot(starts, { x: 'x', y: 'y', fill: 'color', r: 3.5 }),
                  Plot.text(starts, { x: 'x', y: 'y', text: (d: { name: string; y: number }) => `${fmtTick(d.y, spec.unit)}`, dx: -8, textAnchor: 'end', fill: 'color' }),
                ]
              : []),
          ],
        })
      } else if (spec.type === 'grouped' && spec.bars) {
        const data = spec.bars.map((b) => ({ ...b, label: nm(b.label), color: b.highlight ? theme.accent : theme.context }))
        chart = Plot.plot({
          width,
          height,
          style,
          marginLeft: Math.min(180, 14 + Math.max(...data.map((d) => d.label.length)) * fontSize * 0.58),
          marginRight: 56,
          fy: { label: null, padding: 0.25 },
          y: { axis: null, padding: 0.1 },
          x: { grid: true, label: null, tickFormat: (v: number) => fmtTick(v, spec.unit) },
          color: { legend: false },
          marks: [
            Plot.barX(data, { fy: 'label', y: 'group', x: 'value', fill: 'color' }),
            Plot.ruleX([0], { stroke: theme.muted }),
            Plot.text(data, { fy: 'label', y: 'group', x: 'value', text: (d: { value: number }) => fmtTick(d.value, spec.unit), dx: 4, textAnchor: 'start', fill: theme.ink, fontSize: fontSize - 1 }),
          ],
        })
      } else if (spec.bars) {
        const bars = spec.bars.map((b, i) => ({ ...b, label: nm(b.label), color: col(b.highlight, i) }))
        const dot = spec.type === 'dot'
        const neg = bars.some((b) => b.value < 0)
        chart = Plot.plot({
          width,
          height,
          style,
          marginLeft: Math.min(190, 14 + Math.max(...bars.map((d) => d.label.length)) * fontSize * 0.58),
          marginRight: 60,
          y: { label: null, domain: bars.map((b) => b.label), padding: 0.25 },
          x: { grid: true, label: null, tickFormat: (v: number) => fmtTick(v, spec.unit), ticks: 5, zero: !dot || neg, nice: true },
          marks: [
            dot ? Plot.dot(bars, { y: 'label', x: 'value', fill: 'color', r: 6 }) : Plot.barX(bars, { y: 'label', x: 'value', fill: 'color' }),
            Plot.ruleX([0], { stroke: theme.muted }),
            Plot.text(bars, { y: 'label', x: 'value', text: (d: { value: number }) => fmtTick(d.value, spec.unit), dx: neg ? -6 : 6, textAnchor: neg ? 'end' : 'start', fill: theme.ink, fontSize: fontSize - 1 }),
          ],
        })
      } else return
    } catch (e) {
      el.textContent = `Chart could not be drawn: ${(e as Error).message}`
      return
    }
    // Plot draws axes in currentColor; set grid and tick colours from the theme.
    chart.querySelectorAll('[aria-label$="grid"]').forEach((g) => g.setAttribute('stroke', theme.grid))
    chart.querySelectorAll('[aria-label$="tick"]').forEach((g) => g.setAttribute('stroke', theme.grid))
    el.replaceChildren(chart)
    return () => chart.remove()
  }, [spec, theme, width, height, reveal, names, fontFamily, fontSize])
  return <div ref={ref} style={{ width, height, color: theme.ink }} role="img" aria-label={spec.title} />
}
