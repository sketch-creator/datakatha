import type { Fact, Story } from '@/engine'
import type { StoryContent } from '@/llm/content'
import type { Theme } from './themes'

export type TLang = 'en' | 'ml'

export interface TemplateProps {
  story: Story
  content: StoryContent
  lang: TLang
  theme: Theme
  width: number
  source: string
  /** English entity name -> Malayalam, for chart labels in the Malayalam edition. */
  names?: Record<string, string>
}

export const EMPTY_NAMES: Record<string, string> = {}

export function factOf(story: Story, id?: string): Fact | undefined {
  return id ? story.facts.find((f) => f.id === id) : undefined
}

/** The checked display string for a fact: never the model's own rendering. */
export function factText(story: Story, id: string | undefined, lang: TLang): string {
  const f = factOf(story, id)
  if (!f) return ''
  const s = lang === 'ml' ? f.ml : f.en
  return f.kind === 'pct' && lang === 'en' && f.value < 0 ? s.replace(/^-/, '−') : s
}

export const fonts = {
  serif: (lang: TLang) => (lang === 'ml' ? "'Noto Serif Malayalam Variable', serif" : "'Newsreader Variable', Georgia, serif"),
  sans: (lang: TLang) => (lang === 'ml' ? "'Noto Sans Malayalam Variable', 'Manjari', sans-serif" : "'Inter Variable', system-ui, sans-serif"),
  display: (lang: TLang) => (lang === 'ml' ? "'Manjari', 'Noto Sans Malayalam Variable', sans-serif" : "'Inter Variable', system-ui, sans-serif"),
}

/** Malayalam set slightly smaller: the script runs wider and taller. */
export const k = (lang: TLang) => (lang === 'ml' ? 0.86 : 1)

export function sourceLine(source: string, lang: TLang) {
  if (!source) return lang === 'ml' ? 'ഉറവിടം: അപ്‌ലോഡ് ചെയ്ത ഡാറ്റ' : 'Source: uploaded data'
  return lang === 'ml' ? `ഉറവിടം: ${source}` : `Source: ${source}`
}

export const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function invertGlossary(g?: Record<string, string>): Record<string, string> {
  if (!g) return EMPTY_NAMES
  const out: Record<string, string> = {}
  for (const [ml, en] of Object.entries(g)) if (!out[en]) out[en] = ml
  return out
}

export const L = {
  keyPoints: { en: 'Key points', ml: 'പ്രധാന വസ്തുതകൾ' },
  caveat: { en: 'The caveat', ml: 'ശ്രദ്ധിക്കേണ്ടത്' },
  desk: { en: 'Data Desk', ml: 'ഡാറ്റ ഡെസ്ക്' },
  checked: { en: 'Every number checked against the data', ml: 'എല്ലാ കണക്കുകളും ഡാറ്റയുമായി ഒത്തുനോക്കിയത്' },
  inShort: { en: 'In short', ml: 'ചുരുക്കത്തിൽ' },
  then: { en: 'Then', ml: 'അന്ന്' },
  now: { en: 'Now', ml: 'ഇന്ന്' },
  timeline: { en: 'How it happened', ml: 'നാൾവഴി' },
  swipe: { en: 'Swipe →', ml: 'അടുത്തത് →' },
}
