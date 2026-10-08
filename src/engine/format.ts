// House-style number formatting (house-style skill) for English, and Malayalam
// newspaper style with crore/lakh for large numbers.

const SCALE_WORDS: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 }

/** Round half away from zero at `d` decimals (house style: round once, at the end). */
export function round(v: number, d = 0): number {
  const f = 10 ** d
  return (Math.sign(v) * Math.round(Math.abs(v) * f + 1e-9)) / f
}

export function group(v: number, d = 0): string {
  return round(v, d).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** Split "million tonnes" into scale 1e6 and base unit "tonnes". */
export function parseUnit(unit: string): { scale: number; base: string } {
  const m = unit.trim().match(/^(thousand|million|billion|trillion)\s+(.*)$/i)
  if (m) return { scale: SCALE_WORDS[m[1].toLowerCase()], base: m[2] }
  return { scale: 1, base: unit.trim() }
}

/** Decimals for a value in house style: none from 100 up, one below, two below 0.1. */
export function valueDecimals(v: number): number {
  const a = Math.abs(v)
  if (a >= 100) return 0
  if (a >= 0.1 || a === 0) return 1
  return 2
}

export function fmtValue(v: number, unit: string): string {
  const s = group(v, valueDecimals(v))
  return unit ? `${s} ${unit}` : s
}

export function pctDecimals(p: number): number {
  return Math.abs(p) < 10 ? 1 : 0
}

export function fmtPct(p: number, signed = false): string {
  if (round(p, pctDecimals(p)) === 0) p = 0
  const s = group(Math.abs(p), pctDecimals(p))
  const sign = signed ? (p > 0 ? '+' : p < 0 ? '-' : '') : p < 0 ? '-' : ''
  return `${sign}${s}%`
}

export function fmtRatio(r: number): string {
  return `${group(r, 1)} times`
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ---------- Malayalam ----------

const ML_UNITS: [RegExp, string][] = [
  [/^tonnes? per (person|capita|head)$/i, 'ടൺ (ആളോഹരി)'],
  [/^tonnes?$/i, 'ടൺ'],
  [/^(people|persons|population)$/i, 'പേർ'],
  [/^(us )?dollars?$/i, 'ഡോളർ'],
  [/^(international-\$|international dollars?)$/i, 'ഡോളർ'],
  [/^rupees?$/i, 'രൂപ'],
  [/^(kwh|kilowatt-hours?)$/i, 'കിലോവാട്ട് മണിക്കൂർ'],
  [/^years?$/i, 'വർഷം'],
  [/^%$/i, 'ശതമാനം'],
]

export function mlUnit(base: string): string {
  for (const [re, ml] of ML_UNITS) if (re.test(base.trim())) return ml
  return base
}

/** Malayalam large-number style: crore (1e7) and lakh (1e5) instead of million/billion. */
export function mlAmount(absolute: number): { text: string; word: string; mult: number; shown: number; decimals: number } {
  const a = Math.abs(absolute)
  let mult = 1
  let word = ''
  if (a >= 1e7) {
    mult = 1e7
    word = 'കോടി'
  } else if (a >= 1e5) {
    mult = 1e5
    word = 'ലക്ഷം'
  }
  const n = absolute / mult
  const decimals = mult === 1 ? valueDecimals(n) : Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2
  const shown = round(n, decimals)
  const text = group(n, decimals) + (word ? ` ${word}` : '')
  return { text, word, mult, shown, decimals }
}

export function mlValue(v: number, unit: string): string {
  const { scale, base } = parseUnit(unit)
  const amt = mlAmount(v * scale)
  const u = mlUnit(base)
  return u ? `${amt.text} ${u}` : amt.text
}

export function mlPct(p: number): string {
  return `${group(Math.abs(p), pctDecimals(p))} ശതമാനം`
}

export function mlRatio(r: number): string {
  return `${group(r, 1)} മടങ്ങ്`
}

const ML_ORD = ['', 'ഒന്നാം', 'രണ്ടാം', 'മൂന്നാം', 'നാലാം', 'അഞ്ചാം', 'ആറാം', 'ഏഴാം', 'എട്ടാം', 'ഒൻപതാം', 'പത്താം']

export function mlOrdinal(n: number): string {
  return ML_ORD[n] ?? `${n}-ാം`
}
