import type { Story } from '@/engine'
import type { StoryContent } from '@/llm/content'
import { ARTICLE_COMPONENTS } from '@/templates/article'
import { CAROUSEL_COMPONENTS, SLIDE_H, SLIDE_W, slidesFor } from '@/templates/carousel'
import { invertGlossary, type TLang } from '@/templates/shared'
import type { Theme } from '@/templates/themes'

export function ArticleView({ story, content, lang, theme, template, width, source, glossary }: { story: Story; content: StoryContent; lang: TLang; theme: Theme; template: string; width: number; source: string; glossary?: Record<string, string> }) {
  const C = ARTICLE_COMPONENTS[template] ?? ARTICLE_COMPONENTS.broadsheet
  return <C story={story} content={content} lang={lang} theme={theme} width={width} source={source} names={invertGlossary(glossary)} />
}

export function Slide({ story, content, lang, theme, template, index, total, source, glossary, scale }: { story: Story; content: StoryContent; lang: TLang; theme: Theme; template: string; index: number; total: number; source: string; glossary?: Record<string, string>; scale: number }) {
  const C = CAROUSEL_COMPONENTS[template] ?? CAROUSEL_COMPONENTS['big-number']
  return (
    <div style={{ width: SLIDE_W * scale, height: SLIDE_H * scale, overflow: 'hidden', flexShrink: 0, borderRadius: 8 }} className="shadow-lg ring-1 ring-white/10">
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: SLIDE_W, height: SLIDE_H }}>
        <C story={story} content={content} lang={lang} theme={theme} width={SLIDE_W} source={source} names={invertGlossary(glossary)} index={index} total={total} />
      </div>
    </div>
  )
}

export function CarouselView(props: { story: Story; content: StoryContent; lang: TLang; theme: Theme; template: string; source: string; glossary?: Record<string, string>; scale: number }) {
  const slides = slidesFor(props.content, props.template)
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 scroll-thin">
      {slides.map((_, i) => (
        <Slide key={i} {...props} index={i} total={slides.length} />
      ))}
    </div>
  )
}
