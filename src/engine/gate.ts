// Fact-check gate (port and extension of fact-check-gate/scripts/recheck.py).
// Independent of the writer: it reads the finished text, finds every number and every
// comparison, and recomputes them from the fact book and the data. English and Malayalam.
import type { Panel } from './data'
import type { Assertion, Fact, Roles } from './types'

export type Lang = 'en' | 'ml'

export interface GateItem {
  status: 'pass' | 'fail' | 'warn'
  check: 'number' | 'comparison' | 'wording' | 'coverage'
  where: string
  claim: string
  detail: string
  factId?: string
  fix?: string
}

export interface GateResult {
  lang: Lang
  verdict: 'PASS' | 'FAIL'
  items: GateItem[]
  passed: number
  failed: number
  warned: number
  factsUsed: string[]
}

export interface GateInput {
  lang: Lang
  pieces: { where: string; text: string }[]
  facts: Fact[]
  assertions?: Assertion[]
  panel?: Panel
  roles?: Roles
  /** Malayalam name -> dataset entity, supplied with the Malayalam draft. */
  glossary?: Record<string, string>
  /** The story is about a per-person measure (comparisons default to it). */
  perPerson?: boolean
}

// ---------------- tokenising numbers ----------------

type NumKind = 'plain' | 'pct' | 'ratio' | 'pp' | 'rank' | 'year'
type Hedge = 'about' | 'nearly' | 'over' | 'under' | null

interface Num {
  raw: string
  value: number
  decimals: number
  scale: number
  kind: NumKind
  hedge: Hedge
  index: number
  end: number
}

const EN_SCALE: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12, bn: 1e9, m: 1e6, k: 1e3, crore: 1e7, lakh: 1e5 }
const ML_SCALE: [string, number][] = [
  ['കോടി', 1e7],
  ['ലക്ഷ', 1e5],
  ['ആയിര', 1e3],
  ['മില്യ', 1e6],
  ['ബില്യ', 1e9],
]
const EN_WORD_MULT: Record<string, number> = {
  doubled: 2, tripled: 3, trebled: 3, quadrupled: 4, quintupled: 5,
  twofold: 2, threefold: 3, fourfold: 4, fivefold: 5, sixfold: 6, sevenfold: 7, eightfold: 8, ninefold: 9, tenfold: 10,
}
const ML_WORD_MULT: [string, number][] = [
  ['പത്തിരട്ടി', 10], ['ഒൻപതിരട്ടി', 9], ['എട്ടിരട്ടി', 8], ['ഏഴിരട്ടി', 7], ['ആറിരട്ടി', 6],
  ['അഞ്ചിരട്ടി', 5], ['നാലിരട്ടി', 4], ['മൂന്നിരട്ടി', 3], ['ഇരട്ടി', 2],
]
const ML_ORD_WORDS: [string, number][] = [
  ['ഒന്നാം', 1], ['രണ്ടാം', 2], ['മൂന്നാം', 3], ['നാലാം', 4], ['അഞ്ചാം', 5], ['ആറാം', 6], ['ഏഴാം', 7], ['എട്ടാം', 8], ['ഒൻപതാം', 9], ['പത്താം', 10],
]

function hedgeBefore(text: string, idx: number, lang: Lang): Hedge {
  const before = text.slice(Math.max(0, idx - 28), idx).toLowerCase()
  if (lang === 'en') {
    if (/(nearly|almost|close to|just under|not quite)\s*$/.test(before)) return 'nearly'
    if (/(about|around|roughly|some|approximately|approx\.|~)\s*$/.test(before)) return 'about'
    if (/(more than|over|at least|just over|above|upwards of)\s*$/.test(before)) return 'over'
    if (/(less than|under|fewer than|below)\s*$/.test(before)) return 'under'
  } else {
    if (/(ഏകദേശം|ഏതാണ്ട്|ഉദ്ദേശം)\s*$/.test(before)) return 'about'
  }
  return null
}

function hedgeAfterMl(rest: string): Hedge {
  const s = rest.slice(0, 24)
  if (/^[^\s]*(ലധികം|ലേറെ|ത്തിലധികം|ത്തിലേറെ)/.test(s)) return 'over'
  if (/^[^\s]*(ഓളം|ത്തോളം)/.test(s)) return 'about'
  if (/^[^\s]*(ൽ താഴെ|ത്തിൽ താഴെ)/.test(s)) return 'under'
  return null
}

export function extractNumbers(text: string, lang: Lang): Num[] {
  const out: Num[] = []
  const re = /(?<![\w.,])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const intPart = m[1].replace(/,/g, '')
    const dec = m[2] ?? ''
    const value = parseFloat(`${intPart}${dec ? '.' + dec : ''}`)
    let end = m.index + m[0].length
    const rest = text.slice(end)
    let kind: NumKind = 'plain'
    let scale = 1
    let hedge = hedgeBefore(text, m.index, lang)
    if (lang === 'en') {
      let u: RegExpMatchArray | null
      if ((u = rest.match(/^(st|nd|rd|th)\b/i))) {
        kind = 'rank'
        end += u[0].length
      } else if ((u = rest.match(/^\s*(%|per ?cent\b|percent\b)/i))) {
        kind = 'pct'
        end += u[0].length
      } else if ((u = rest.match(/^\s*(percentage points?|points?)\b/i))) {
        kind = 'pp'
        end += u[0].length
      } else if ((u = rest.match(/^\s*(-?fold\b|times\b|x\b|×)/i))) {
        kind = 'ratio'
        end += u[0].length
      } else if ((u = rest.match(/^\s*(thousand|million|billion|trillion|bn|crore|lakh)\b/i)) || (u = rest.match(/^(m|k|bn)\b/))) {
        scale = EN_SCALE[u[1].toLowerCase()]
        end += u[0].length
        const r2 = text.slice(end)
        if (/^\s*(%|per ?cent|percent)/i.test(r2)) kind = 'pct'
      }
    } else {
      const r = rest.replace(/^-/, '')
      let u: RegExpMatchArray | null
      if (/^(-?ാം|ആം|-ാമ|ാമ)/.test(rest)) kind = 'rank'
      else if ((u = r.match(/^\s*(%|ശതമാന)/))) {
        kind = 'pct'
        end += u[0].length
      } else if ((u = r.match(/^\s*(ശതമാന ?പോയിന്റ്|പോയിന്റ്)/))) kind = 'pp'
      else if ((u = r.match(/^\s*(മടങ്ങ|ഇരട്ടി|x|×)[^\s.,;:()]*/))) {
        kind = 'ratio'
        end += u[0].length
      } else {
        const w = r.match(/^\s*([^\s.,;:()]+)/)
        const hit = w ? ML_SCALE.find(([p]) => w[1].startsWith(p)) : undefined
        if (hit && w) {
          scale = hit[1]
          end += w[0].length
          hedge = hedge ?? hedgeAfterMl(w[1].slice(hit[0].length))
          const r2 = text.slice(end)
          if (/^\s*(%|ശതമാന)/.test(r2)) kind = 'pct'
        }
      }
      hedge = hedge ?? hedgeAfterMl(rest)
    }
    if (kind === 'plain' && scale === 1 && !dec && value >= 1800 && value <= 2100 && intPart.length === 4) kind = 'year'
    out.push({ raw: text.slice(m.index, end), value, decimals: dec.length, scale, kind, hedge, index: m.index, end })
  }
  // Word multiples: "fourfold", "doubled", Malayalam "നാലിരട്ടി".
  if (lang === 'en') {
    const wr = /\b(doubled|tripled|trebled|quadrupled|quintupled|(?:two|three|four|five|six|seven|eight|nine|ten)fold)\b/gi
    while ((m = wr.exec(text))) {
      out.push({ raw: m[0], value: EN_WORD_MULT[m[1].toLowerCase()], decimals: 0, scale: 1, kind: 'ratio', hedge: hedgeBefore(text, m.index, lang), index: m.index, end: m.index + m[0].length })
    }
    const hr = /\b(halved|by half)\b/gi
    while ((m = hr.exec(text))) {
      out.push({ raw: m[0], value: 50, decimals: 0, scale: 1, kind: 'pct', hedge: hedgeBefore(text, m.index, lang) ?? 'about', index: m.index, end: m.index + m[0].length })
    }
  } else {
    for (const [w, v] of ML_WORD_MULT) {
      let i = -1
      while ((i = text.indexOf(w, i + 1)) !== -1) {
        // skip "ഇരട്ടി" right after a digit (already read as "17 ഇരട്ടി") and longer words containing it
        if (w === 'ഇരട്ടി' && (/\d\s*$/.test(text.slice(0, i)) || /[ഀ-ൿ]$/.test(text.slice(0, i)))) continue
        out.push({ raw: w, value: v, decimals: 0, scale: 1, kind: 'ratio', hedge: null, index: i, end: i + w.length })
      }
    }
    for (const [w, v] of ML_ORD_WORDS) {
      let i = -1
      while ((i = text.indexOf(w, i + 1)) !== -1) {
        if (/[ഀ-ൿ]$/.test(text.slice(0, i))) continue
        out.push({ raw: w, value: v, decimals: 0, scale: 1, kind: 'rank', hedge: null, index: i, end: i + w.length })
      }
    }
  }
  return out.sort((a, b) => a.index - b.index)
}

// ---------------- matching numbers to facts ----------------

function within(actual: number, written: number, tol: number, hedge: Hedge): boolean {
  const a = Math.abs(actual)
  const w = Math.abs(written)
  switch (hedge) {
    case 'about':
      return Math.abs(a - w) <= Math.max(tol, 0.06 * w)
    case 'nearly':
      return a <= w + tol && a >= 0.88 * w
    case 'over':
      return a >= w - tol && a <= 1.3 * w
    case 'under':
      return a <= w + tol && a >= 0.7 * w
    default:
      return Math.abs(a - w) <= tol + 1e-9 * Math.max(1, w)
  }
}

export function matchFact(n: Num, facts: Fact[]): Fact[] {
  const tol = 0.5 * 10 ** -n.decimals
  return facts.filter((f) => {
    switch (n.kind) {
      case 'pct':
        return f.kind === 'pct' && within(f.value, n.value * n.scale, tol * n.scale, n.hedge)
      case 'ratio':
        return (f.kind === 'ratio' && within(f.value, n.value, tol, n.hedge)) || (f.kind === 'pct' && within(f.value / 100 + 1, n.value, tol, n.hedge))
      case 'pp':
        return f.kind === 'pp' && within(f.value, n.value, tol, n.hedge)
      case 'rank':
        return f.kind === 'rank' && f.value === n.value
      case 'year':
        return f.kind === 'year' ? f.value === n.value : f.kind === 'value' && n.scale === 1 && within(f.value, n.value, tol, n.hedge)
      default: {
        if (f.kind === 'count' || f.kind === 'rank') return n.scale === 1 && !n.decimals && f.value === n.value
        if (f.kind !== 'value') return false
        const abs = f.value * f.scale
        if (within(abs, n.value * n.scale, tol * n.scale, n.hedge)) return true
        return n.scale === 1 && within(f.value, n.value, tol, n.hedge)
      }
    }
  })
}

const FALL_EN = /\b(fell|fall|falls|falling|cut|cuts|drop|dropped|drops|declin\w*|down|lower|decreas\w*|shrank|shrunk|reduc\w*|halved|slid|plunged|less)\b/gi
const RISE_EN = /\b(rose|rise|rises|rising|grew|grow|grows|growth|up|increas\w*|higher|climb\w*|jump\w*|surg\w*|doubled|tripled|added|more)\b/gi
const FALL_ML = /(കുറഞ്ഞ|കുറവ്|കുറച്ച|ഇടിഞ്ഞ|ഇടിവ്|താഴ്ന്ന|കുറയ)/g
const RISE_ML = /(വർധ|വർദ്ധ|ഉയർന്ന|ഉയർച്ച|കൂടി|കൂടുതൽ|കുതിച്ച|വളർന്ന|വളർച്ച)/g

/** Nearest direction word to the number within the same clause: -1 fall, +1 rise, 0 none. */
function direction(text: string, n: Num, lang: Lang): number {
  const start = Math.max(0, text.lastIndexOf(',', n.index) + 1, text.lastIndexOf(';', n.index) + 1)
  const stops = [',', ';', '.', '('].map((c) => text.indexOf(c, n.end)).filter((i) => i !== -1)
  const end = Math.min(text.length, ...stops)
  const clause = text.slice(start, end)
  const pos = n.index - start
  let best = 0
  let bestDist = Infinity
  for (const [re, dir] of (lang === 'en' ? [[FALL_EN, -1], [RISE_EN, 1]] : [[FALL_ML, -1], [RISE_ML, 1]]) as [RegExp, number][]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(clause))) {
      const d = m.index < pos ? pos - m.index : m.index - (pos + n.raw.length)
      if (d >= 0 && d < bestDist && d < (lang === 'en' ? 40 : 30)) {
        best = dir
        bestDist = d
      }
    }
  }
  return best
}

// ---------------- entities and comparisons ----------------

const ALIASES: Record<string, string[]> = {
  'United States': ['the United States', 'the US', 'the U.S.', 'US', 'U.S.', 'USA', 'America'],
  'United Kingdom': ['the United Kingdom', 'the UK', 'the U.K.', 'UK', 'U.K.', 'Britain', 'Great Britain'],
  'Democratic Republic of Congo': ['DR Congo', 'DRC', 'the DRC'],
  Netherlands: ['the Netherlands'],
  'United Arab Emirates': ['the UAE', 'UAE', 'the United Arab Emirates'],
  Russia: ['the Russian Federation'],
  'South Korea': ['Korea'],
}

interface Mention {
  entity: string
  index: number
  end: number
  ml?: string
}

export function findEntities(text: string, names: string[], lang: Lang, glossary: Record<string, string> = {}): Mention[] {
  const pairs: [string, string][] = []
  if (lang === 'en') {
    for (const n of names) {
      pairs.push([n, n])
      for (const a of ALIASES[n] ?? []) pairs.push([a, n])
    }
  } else {
    for (const [ml, en] of Object.entries(glossary)) if (names.includes(en)) pairs.push([mlStem(ml), en])
  }
  pairs.sort((a, b) => b[0].length - a[0].length)
  // Malayalam: match on a normalised copy (chillu -> consonant, no virama/ZWJ), mapped back to the original.
  const { norm, map } = lang === 'ml' ? mlNormalize(text) : { norm: text, map: [...text].map((_, i) => i) }
  const taken: boolean[] = new Array(norm.length).fill(false)
  const out: Mention[] = []
  for (const [alias, entity] of pairs) {
    if (alias.length < 2) continue
    let i = -1
    while ((i = norm.indexOf(alias, i + 1)) !== -1) {
      const before = norm[i - 1] ?? ' '
      const after = norm[i + alias.length] ?? ' '
      if (lang === 'en' && (/[\w]/.test(before) || /[a-z]/.test(after))) continue
      if (lang === 'ml' && /[\u0D00-\u0D7F]/.test(before)) continue
      if (taken.slice(i, i + alias.length).some(Boolean)) continue
      for (let k = i; k < i + alias.length; k++) taken[k] = true
      const start = map[i]
      let end = map[i + alias.length - 1] + 1
      if (lang === 'ml') while (end < text.length && /[\u0D00-\u0D7F\u200C\u200D]/.test(text[end])) end++
      out.push({ entity, index: start, end, ml: lang === 'ml' ? text.slice(start, end) : undefined })
    }
  }
  return out.sort((a, b) => a.index - b.index)
}

const CHILLU: Record<string, string> = { '\u0D7A': '\u0D23', '\u0D7B': '\u0D28', '\u0D7C': '\u0D30', '\u0D7D': '\u0D32', '\u0D7E': '\u0D33', '\u0D7F': '\u0D15', '\u0D54': '\u0D2E', '\u0D55': '\u0D2F', '\u0D56': '\u0D34' }

/** Map chillu letters to their consonants and drop virama and joiners, keeping an index map. */
export function mlNormalize(text: string): { norm: string; map: number[] } {
  let norm = ''
  const map: number[] = []
  const t = text.normalize('NFC')
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (ch === '\u0D4D' || ch === '\u200C' || ch === '\u200D') continue
    norm += CHILLU[ch] ?? ch
    map.push(i)
  }
  return { norm, map }
}

/** Malayalam names inflect: ജപ്പാൻ -> ജപ്പാനെ, ജർമ്മനി -> ജർമ്മൻകാരൻ. Match on a normalised stem. */
export function mlStem(name: string): string {
  let s = mlNormalize(name).norm
  if (/[\u0D3E-\u0D4C\u0D57]$/.test(s) && s.length > 3) s = s.slice(0, -1)
  return s
}

type Cmp = { a: string; b: string[]; op: 'gt' | 'lt' | 'passed'; clause: string; where: string; perPerson: boolean; years: Record<string, number> }

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?।])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
}

const PER_PERSON = {
  en: /per (person|capita|head)|per-person|per-capita|each (person|resident)|average (person|resident|citizen)/i,
  ml: /(ആളോഹരി|ഒരാൾ|പ്രതിശീർഷ|ഓരോ വ്യക്തി|ആൾക്ക്|ഓരോരുത്തരും|ശരാശരി ഒരു)/,
}
const TOTAL = { en: /(total|overall|in all|altogether|million tonnes|billion tonnes)/i, ml: /(ആകെ|മൊത്തം|മൊത്ത)/ }

/** Year attached to each entity: the first year after it in the sentence, before the next entity. */
function yearsFor(s: string, ents: Mention[]): Record<string, number> {
  const ys = [...s.matchAll(/(?<!\d)(1[89]\d\d|20\d\d)(?!\d)/g)].map((m) => ({ y: +m[1], i: m.index! }))
  const out: Record<string, number> = {}
  ents.forEach((e, k) => {
    const next = ents[k + 1]?.index ?? Infinity
    const y = ys.find((x) => x.i > e.index && x.i < next)
    if (y) out[e.entity] = y.y
  })
  return out
}

function findComparisons(text: string, where: string, names: string[], lang: Lang, glossary?: Record<string, string>, defaultPerPerson = false): Cmp[] {
  const out: Cmp[] = []
  let perPerson = defaultPerPerson
  for (const s of sentences(text)) {
    if (PER_PERSON[lang].test(s)) perPerson = true
    else if (TOTAL[lang].test(s)) perPerson = false
    const ents = findEntities(s, names, lang, glossary)
    if (ents.length < 2) continue
    const years = yearsFor(s, ents)
    if (lang === 'en') {
      const re = /\b(more|higher|greater|larger|bigger|less|lower|fewer|smaller)\b[^.;]*?\bthan\b|\b(overtook|overtaken|passed|surpassed|outstripped|overtaking|passing)\b|\b(ahead of|behind)\b/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(s))) {
        const kw = (m[1] ?? m[2] ?? m[3]).toLowerCase()
        const before = ents.filter((e) => e.end <= m!.index)
        if (!before.length) continue
        const clauseEnd = (() => {
          const rest = s.slice(m!.index + m![0].length)
          const stop = rest.search(/[;:]|\bbut\b|\bwhile\b|\bwhereas\b|\band (?:is|was|has|now)\b/)
          return m!.index + m![0].length + (stop === -1 ? rest.length : stop)
        })()
        const after = ents.filter((e) => e.index >= m!.index + m![0].length && e.index < clauseEnd).map((e) => e.entity)
        if (!after.length) continue
        const a = before[before.length - 1].entity
        let op: Cmp['op'] = /more|higher|greater|larger|bigger|ahead/.test(kw) ? 'gt' : 'lt'
        if (/overt|pass|surpass|outstrip/.test(kw)) op = 'passed'
        out.push({ a, b: [...new Set(after.filter((x) => x !== a))], op, clause: s, where, perPerson, years })
      }
    } else {
      // "ചൈന ... ജർമ്മനിയെക്കാൾ കൂടുതൽ" (more than), "... കുറവ്" (less), "... മറികടന്നു" (passed)
      const thanEnts = ents.filter((e) => /(കാൾ|കാള)/.test(e.ml ?? ''))
      const acc = (e: Mention) => /(യെ|നെ|ളെ|രെ|ത്തെ)(യും)?$/.test(e.ml ?? '') && !/(ുടെ|ന്റെ)$/.test(e.ml ?? '')
      let objEnts = ents.filter(acc)
      const listKw = s.search(/എന്നിവയെ/)
      if (listKw !== -1) {
        const start = Math.max(s.lastIndexOf(';', listKw), s.lastIndexOf(':', listKw), 0)
        objEnts = [...objEnts, ...ents.filter((e) => e.index > start && e.index < listKw)]
      }
      const passedKw = /(മറികടന്ന|മറികടക്ക|പിന്നിലാക്ക|പിന്തള്ള|കടത്തിവെട്ട)/.test(s)
      const more = /(കൂടുതൽ|കൂടുതല|അധിക|ഉയർന്ന|മുന്നിൽ|മുന്നില)/.test(s)
      const less = /(കുറവ|കുറഞ്ഞ|പിന്നിൽ|പിന്നില)/.test(s) && !/പിന്നിലാക്ക/.test(s)
      if (thanEnts.length && (more || less) && !(more && less)) {
        const subject = ents.find((e) => !thanEnts.includes(e))
        if (subject) out.push({ a: subject.entity, b: [...new Set(thanEnts.map((e) => e.entity))].filter((x) => x !== subject.entity), op: more ? 'gt' : 'lt', clause: s, where, perPerson, years })
      } else if (passedKw && objEnts.length) {
        const subject = ents.find((e) => !objEnts.includes(e))
        if (subject) out.push({ a: subject.entity, b: [...new Set(objEnts.map((e) => e.entity))].filter((x) => x !== subject.entity), op: 'passed', clause: s, where, perPerson, years })
      }
    }
  }
  return out.filter((c) => c.b.length)
}

function verifyComparison(c: Cmp, panel: Panel, roles: Roles) {
  const col = c.perPerson && roles.rate ? roles.rate : roles.value
  const all = [...c.clause.matchAll(/(?<!\d)(1[89]\d\d|20\d\d)(?!\d)/g)].map((m) => +m[1]).filter((y) => panel.periods.includes(y))
  const res: GateItem[] = []
  for (const b of c.b) {
    const year = c.years[b] ?? (all.length ? Math.max(...all) : roles.latest)
    const va = panel.get(c.a, year, col)
    const vb = panel.get(b, year, col)
    const label = `${c.a} ${c.op === 'gt' ? '>' : c.op === 'lt' ? '<' : 'passed'} ${b} (${roles.labels[col] ?? col}, ${year})`
    if (va === null || vb === null) {
      res.push({ status: 'warn', check: 'comparison', where: c.where, claim: c.clause, detail: `${label}: no data for one side; check by hand.` })
      continue
    }
    let ok: boolean
    let detail = `${c.a} ${fmt(va)} vs ${b} ${fmt(vb)}`
    if (c.op === 'passed') {
      const earlier = panel.periods.filter((t) => t < year).some((t) => {
        const x = panel.get(c.a, t, col)
        const y = panel.get(b, t, col)
        return x !== null && y !== null && x < y
      })
      ok = va > vb && earlier
      if (!earlier) detail += `; ${c.a} was never behind ${b} earlier in the file`
    } else ok = c.op === 'gt' ? va > vb : va < vb
    res.push({
      status: ok ? 'pass' : 'fail',
      check: 'comparison',
      where: c.where,
      claim: c.clause,
      detail: `${label}: ${detail}`,
      fix: ok ? undefined : `The data says the opposite: ${c.a} ${fmt(va)} vs ${b} ${fmt(vb)} in ${year}. Rewrite or drop this comparison.`,
    })
  }
  return res
}

// ---------------- the engine's assertions ----------------
// The comparison parser above knows a fixed list of phrasings ("more ... than", "passed").
// As a second net, every assertion the engine computed ("A emits more per person than B
// in 2024", holds true or false) is matched against sentences the parser did not rule on:
// a sentence that names both places with a direction word must agree with the assertion.

type Dir = 1 | -1
const A_GT = /\b(more|higher|greater|larger|bigger|ahead)\b/i
const A_LT = /\b(less|lower|fewer|smaller|behind)\b/i
// "more/less ... than" is left to the parser: here it is too often "more than 20%".
const S_GT_EN = /\b(higher|greater|larger|bigger|ahead|above|tops?|topped|outpac\w*|outstrip\w*|exceed\w*|beats?|eclips\w*|overtook|overtaken|passed|surpass\w*)\b/gi
const S_LT_EN = /\b(lower|smaller|behind|below|trails?|trailed|trailing)\b/gi
const S_GT_ML = /(കൂടുതൽ|കൂടുതല|അധിക|ഉയർന്ന|മുന്നിൽ|മുന്നില|മറികടന്ന|മറികടക്ക|പിന്നിലാക്ക|പിന്തള്ള)/g
const S_LT_ML = /(കുറവ|കുറഞ്ഞ|പിന്നിൽ(?!ാക്ക)|പിന്നില(?!ാക്ക))/g
const NOW = { en: /\b(now|today|still|currently|these days)\b/i, ml: /(ഇപ്പോൾ|ഇപ്പോഴും|ഇന്ന്|ഇന്നും|നിലവിൽ)/ }
const YEAR_RE = /(?<!\d)(1[89]\d\d|20\d\d)(?!\d)/g

function checkAssertions(text: string, where: string, lang: Lang, input: GateInput, ruled: Set<string>): GateItem[] {
  const names = input.panel!.entities
  const roles = input.roles!
  const out: GateItem[] = []
  const claims = (input.assertions ?? []).flatMap((a) => {
    const ents = [...new Set(findEntities(a.text, names, 'en').map((e) => e.entity))]
    const gt = A_GT.test(a.text)
    const lt = A_LT.test(a.text)
    if (ents.length !== 2 || gt === lt) return []
    const years = [...a.text.matchAll(YEAR_RE)].map((m) => +m[1])
    return [{ a, first: ents[0], second: ents[1], dir: (gt ? 1 : -1) as Dir, year: years.at(-1) ?? roles.latest, perPerson: PER_PERSON.en.test(a.text) }]
  })
  if (!claims.length) return out
  let perPerson = input.perPerson ?? false
  for (const s of sentences(text)) {
    if (PER_PERSON[lang].test(s)) perPerson = true
    else if (TOTAL[lang].test(s)) perPerson = false
    if (ruled.has(s)) continue
    const ents = findEntities(s, names, lang, input.glossary)
    if (ents.length < 2) continue
    const [gtRe, ltRe] = lang === 'en' ? [S_GT_EN, S_LT_EN] : [S_GT_ML, S_LT_ML]
    const has = (re: RegExp) => {
      re.lastIndex = 0
      return re.test(s)
    }
    const up = has(gtRe)
    const down = has(ltRe)
    if (up === down) continue // no direction, or both: too ambiguous to judge
    const dir: Dir = up ? 1 : -1
    const years = [...s.matchAll(YEAR_RE)].map((m) => +m[1])
    for (const c of claims) {
      const m1 = ents.find((e) => e.entity === c.first)
      const m2 = ents.find((e) => e.entity === c.second)
      if (!m1 || !m2 || c.perPerson !== perPerson) continue
      // No year in the sentence: judge it only when it plainly speaks about today.
      if (years.length ? !years.includes(c.year) : c.year !== roles.latest || !NOW[lang].test(s)) continue
      // Subject: in Malayalam the "than" place carries -കാൾ; otherwise the first named.
      const than = (e: Mention) => /(കാൾ|കാള)/.test(e.ml ?? '')
      const subjectIsFirst = lang === 'ml' && (than(m1) || than(m2)) ? than(m2) : m1.index < m2.index
      const says = subjectIsFirst ? dir : (-dir as Dir)
      const ok = (says === c.dir) === c.a.holds
      out.push({
        status: ok ? 'pass' : 'fail',
        check: 'comparison',
        where,
        claim: s,
        detail: `Checked against the engine's finding "${c.a.text}" (${c.a.holds ? 'true' : 'not true'}: ${c.a.detail}).`,
        fix: ok ? undefined : `The data says: ${c.a.holds ? c.a.text : `not "${c.a.text}"`} (${c.a.detail}). Rewrite or drop this comparison.`,
      })
    }
  }
  return out
}

function fmt(v: number): string {
  return Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : (Math.round(v * 10) / 10).toFixed(1)
}

// ---------------- the gate ----------------

const SMALL_OK = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

export function runGate(input: GateInput): GateResult {
  const { lang, pieces, facts } = input
  const items: GateItem[] = []
  const used = new Set<string>()
  const names = input.panel ? input.panel.entities : []
  const periods = new Set(input.panel?.periods ?? [])

  for (const { where, text } of pieces) {
    if (!text) continue
    const ents = names.length ? findEntities(text, names, lang, input.glossary) : []
    for (const n of extractNumbers(text, lang)) {
      // CO₂-style subscripts and list numbering are not claims.
      if (/[A-Za-z]$/.test(text.slice(0, n.index)) || (n.kind === 'plain' && /^\s*[.)]\s/.test(text.slice(n.end)) && n.index < 3)) continue
      let hits = matchFact(n, facts)
      if (n.kind === 'year' && !hits.length && periods.has(n.value)) {
        items.push({ status: 'pass', check: 'number', where, claim: n.raw, detail: `Year ${n.value} is in the data.` })
        continue
      }
      if (!hits.length && n.kind === 'plain' && n.scale === 1 && !n.decimals && SMALL_OK.has(n.value)) {
        items.push({ status: 'warn', check: 'number', where, claim: n.raw, detail: 'Small whole number not in the fact sheet (a count?). Check by hand.' })
        continue
      }
      if (!hits.length) {
        const sentenceEnts = ents.filter((e) => Math.abs(e.index - n.index) < 120).map((e) => e.entity)
        const near = nearest(n, facts.filter((f) => f.entity && sentenceEnts.includes(f.entity))) ?? nearest(n, facts)
        items.push({
          status: 'fail',
          check: 'number',
          where,
          claim: contextOf(text, n),
          detail: `"${n.raw}" does not match any number computed from the data.`,
          fix: near ? `Closest computed value: ${lang === 'ml' ? near.ml : near.en} (${near.label}).` : 'Remove this number or replace it with one from the fact sheet.',
        })
        continue
      }
      // Prefer facts about an entity named nearby.
      const nearby = ents.filter((e) => Math.abs(e.index - n.index) < 160).map((e) => e.entity)
      const ranked = [...hits].sort((a, b) => Number(nearby.includes(b.entity ?? '')) - Number(nearby.includes(a.entity ?? '')))
      hits = ranked
      const dir = n.kind === 'pct' || n.kind === 'ratio' ? direction(text, n, lang) : 0
      const signed = hits.find((f) => f.kind === 'pct')
      if (dir !== 0 && n.kind === 'pct' && signed && hits.every((f) => f.kind !== 'pct' || Math.sign(f.value) !== dir) && hits.some((f) => f.kind === 'pct' && f.value !== 0)) {
        items.push({
          status: 'fail',
          check: 'number',
          where,
          claim: contextOf(text, n),
          detail: `${n.raw} matches ${signed.label} (${signed.en}), but the text says it went ${dir > 0 ? 'up' : 'down'}.`,
          factId: signed.id,
          fix: `It went ${signed.value > 0 ? 'up' : 'down'}: fix the verb.`,
        })
        continue
      }
      const f = hits[0]
      used.add(f.id)
      items.push({ status: 'pass', check: 'number', where, claim: n.raw, detail: `${f.label} = ${lang === 'ml' ? f.ml : f.en}${n.hedge ? ` (${n.hedge})` : ''}`, factId: f.id })
    }

    if (input.panel && input.roles) {
      const cmps = findComparisons(text, where, names, lang, input.glossary, input.perPerson)
      for (const c of cmps) items.push(...verifyComparison(c, input.panel, input.roles))
      if (input.assertions?.length) items.push(...checkAssertions(text, where, lang, input, new Set(cmps.map((c) => c.clause))))
    }

    if (lang === 'en') {
      if (/\b(caus(e|ed|es|ing))\b/i.test(text)) items.push({ status: 'warn', check: 'wording', where, claim: 'caused', detail: 'House style: say "linked to" unless the source shows cause.' })
      if (/\b(record|highest ever|all-time)\b/i.test(text) && !facts.some((f) => /highest|record/i.test(f.label)))
        items.push({ status: 'warn', check: 'wording', where, claim: 'record', detail: 'House style: avoid "record" unless the full series was checked.' })
      if (where === 'headline' && text.length > 60) items.push({ status: 'warn', check: 'wording', where, claim: text, detail: `Headline is ${text.length} characters; house style is 60 or fewer.` })
    }
  }

  const failed = items.filter((i) => i.status === 'fail').length
  const warned = items.filter((i) => i.status === 'warn').length
  return { lang, verdict: failed ? 'FAIL' : 'PASS', items, passed: items.filter((i) => i.status === 'pass').length, failed, warned, factsUsed: [...used] }
}

function contextOf(text: string, n: Num): string {
  const s = Math.max(0, n.index - 40)
  const e = Math.min(text.length, n.end + 30)
  return (s > 0 ? '…' : '') + text.slice(s, e).trim() + (e < text.length ? '…' : '')
}

function nearest(n: Num, facts: Fact[]): Fact | null {
  const target = n.value * n.scale
  let best: Fact | null = null
  let bestErr = Infinity
  for (const f of facts) {
    const compatible = n.kind === 'pct' ? f.kind === 'pct' : n.kind === 'ratio' ? f.kind === 'ratio' : n.kind === 'rank' ? f.kind === 'rank' : f.kind === 'value' || f.kind === 'count' || f.kind === 'year'
    if (!compatible) continue
    for (const v of [f.value, f.value * f.scale]) {
      const err = Math.abs(Math.abs(v) - target) / Math.max(1e-9, Math.abs(target))
      if (err < bestErr) {
        bestErr = err
        best = f
      }
    }
  }
  return bestErr < 0.5 ? best : null
}

/** EN and ML should rest on the same facts. */
export function parity(en: GateResult, ml: GateResult, facts: Fact[]): GateItem[] {
  const onlyEn = en.factsUsed.filter((id) => !ml.factsUsed.includes(id))
  const onlyMl = ml.factsUsed.filter((id) => !en.factsUsed.includes(id))
  const label = (id: string) => facts.find((f) => f.id === id)?.label ?? id
  const items: GateItem[] = []
  for (const id of onlyEn) items.push({ status: 'warn', check: 'coverage', where: 'ml', claim: label(id), detail: 'Used in English, not found in Malayalam.', factId: id })
  for (const id of onlyMl) items.push({ status: 'warn', check: 'coverage', where: 'en', claim: label(id), detail: 'Used in Malayalam, not found in English.', factId: id })
  return items
}
