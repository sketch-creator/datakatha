// PDF and Word exports. The PDF is a picture of the preview, so Malayalam looks exactly as
// on screen; the Word file is real, editable text. Both libraries load only when used.
import { toCanvas } from 'html-to-image'
import type { GateResult } from '@/engine/gate'
import type { StoryContent } from '@/llm/content'
import type { Theme } from '@/templates/themes'
import { download, slug } from './export'

type Lang = 'en' | 'ml'
const A4 = { w: 210, h: 297 } // mm

/** Bottom edges of blocks inside the article, so page breaks fall between lines, not through them. */
function breakPoints(node: HTMLElement): number[] {
  const top = node.getBoundingClientRect().top
  const ys = [...node.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, li, figure, blockquote, table, hr, svg, img')].map((e) => e.getBoundingClientRect().bottom - top)
  return [...new Set(ys.map((y) => Math.ceil(y)))].sort((a, b) => a - b)
}

/** The colour the article actually paints, so the rest of each page matches it. */
function paintedBg(node: HTMLElement, fallback: string): string {
  const m = getComputedStyle(node).backgroundColor.match(/\d+(\.\d+)?/g)
  if (!m || (m.length === 4 && Number(m[3]) === 0)) return fallback
  return '#' + m.slice(0, 3).map((v) => Math.round(Number(v)).toString(16).padStart(2, '0')).join('')
}

/** Article as A4 pages, breaking between paragraphs where it can. */
export async function articlePdf(node: HTMLElement, title: string, fileBase: string, lang: Lang, themeBg: string) {
  await document.fonts.ready
  const { jsPDF } = await import('jspdf')
  const bg = paintedBg(node, themeBg)
  const ratio = 2
  const canvas = await toCanvas(node, { pixelRatio: ratio, cacheBust: true, backgroundColor: bg })
  const cssW = node.offsetWidth
  const mm = cssW / A4.w // CSS px per mm at full page width
  const [topMm, bottomMm] = [14, 12] // the first page starts at the top: the article has its own padding
  const breaks = breakPoints(node)
  const total = node.offsetHeight
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({ title, creator: 'Data Katha' })
  let start = 0
  let page = 0
  while (start < total - 1) {
    const top = page === 0 ? 0 : topMm
    const room = (A4.h - top - bottomMm) * mm
    let end = Math.min(total, start + room)
    if (end < total) {
      const ok = breaks.filter((y) => y > start + room * 0.5 && y <= end - 2)
      if (ok.length) end = ok[ok.length - 1] + 2
    }
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = Math.round((end - start) * ratio)
    const ctx = slice.getContext('2d')!
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(canvas, 0, Math.round(start * ratio), canvas.width, slice.height, 0, 0, slice.width, slice.height)
    if (page > 0) pdf.addPage()
    pdf.setFillColor(bg)
    pdf.rect(0, 0, A4.w, A4.h, 'F')
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, top, A4.w, (end - start) / mm)
    start = end
    page++
  }
  download(`${slug(fileBase)}-${lang}.pdf`, pdf.output('blob'))
}

/** Carousel slides, one page each at the slide's own size (the format LinkedIn takes for carousels). */
export async function slidesPdf(nodes: HTMLElement[], base: string, title: string, onProgress?: (i: number) => void) {
  await document.fonts.ready
  const { jsPDF } = await import('jspdf')
  const [w, h] = [nodes[0].offsetWidth, nodes[0].offsetHeight]
  const pdf = new jsPDF({ unit: 'px', format: [w, h], orientation: h >= w ? 'portrait' : 'landscape', hotfixes: ['px_scaling'], compress: true })
  pdf.setProperties({ title, creator: 'Data Katha' })
  for (let i = 0; i < nodes.length; i++) {
    onProgress?.(i)
    const canvas = await toCanvas(nodes[i], { pixelRatio: 1, cacheBust: true })
    if (i > 0) pdf.addPage([w, h], h >= w ? 'portrait' : 'landscape')
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h)
  }
  download(`${base}-carousel.pdf`, pdf.output('blob'))
}

export interface WordInput {
  content: StoryContent
  lang: Lang
  source: string
  theme: Theme
  gate?: GateResult
  /** PNG of the chart, captured from an off-screen render. */
  chart?: { data: Uint8Array; width: number; height: number }
  /** Slide text, included when the story is being made as a carousel. */
  slides?: { kicker: string; headline: string; body: string }[]
  /** English headline for the file name (a Malayalam headline would slug to nothing). */
  fileBase?: string
}

export async function chartPng(node: HTMLElement): Promise<WordInput['chart']> {
  await document.fonts.ready
  const canvas = await toCanvas(node, { pixelRatio: 2, cacheBust: true })
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) return undefined
  return { data: new Uint8Array(await blob.arrayBuffer()), width: node.offsetWidth, height: node.offsetHeight }
}

/** Editable Word file: the article (and the slide text for carousels), plus a desk note on the fact-check. */
export async function storyDocx(p: WordInput) {
  const { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } = await import('docx')
  const c = p.content
  const ml = p.lang === 'ml'
  // Word picks the complex-script font for Malayalam; Nirmala UI ships with Windows, other systems substitute.
  const font = ml ? { ascii: 'Nirmala UI', hAnsi: 'Nirmala UI', cs: 'Nirmala UI' } : { ascii: 'Georgia', hAnsi: 'Georgia', cs: 'Georgia' }
  const sans = ml ? font : { ascii: 'Arial', hAnsi: 'Arial', cs: 'Arial' }
  const language = ml ? { value: 'en-IN', bidirectional: 'ml-IN' } : { value: 'en-GB' }
  const accent = (p.theme.dark ? '#2a78d6' : p.theme.accent).replace('#', '')
  type RunOpts = { bold?: boolean; italics?: boolean; size?: number; color?: string; sans?: boolean }
  const run = (text: string, o: RunOpts = {}) =>
    new TextRun({ text, bold: o.bold, boldComplexScript: o.bold, italics: o.italics, italicsComplexScript: o.italics, size: o.size, sizeComplexScript: o.size, color: o.color, font: o.sans ? sans : font, language })
  const para = (text: string, o: RunOpts & { after?: number } = {}) => new Paragraph({ children: [run(text, o)], spacing: { after: o.after ?? 160, line: ml ? 320 : 300 } })

  const out: InstanceType<typeof Paragraph>[] = []
  if (c.kicker) out.push(para(ml ? c.kicker : c.kicker.toUpperCase(), { bold: true, size: 18, color: accent, sans: true, after: 80 }))
  out.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [run(c.headline, { bold: true, size: 44 })], spacing: { after: 160 } }))
  if (c.dek) out.push(para(c.dek, { italics: true, size: 26, color: '444444', after: 240 }))
  if (p.chart) {
    if (c.chart_title) out.push(para(c.chart_title, { bold: true, size: 22, sans: true, after: 40 }))
    if (c.chart_subtitle) out.push(para(c.chart_subtitle, { size: 18, color: '666666', sans: true, after: 80 }))
    const w = 600
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new ImageRun({ type: 'png', data: p.chart.data, transformation: { width: w, height: Math.round((p.chart.height / p.chart.width) * w) }, altText: { name: 'Chart', title: c.chart_title || 'Chart', description: c.alt_text || c.chart_title } })],
      }),
    )
  }
  for (const b of c.body) out.push(para(b, { size: 23 }))
  if (c.key_points.length) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [run(ml ? 'പ്രധാന വസ്തുതകൾ' : 'Key points', { bold: true, size: 26, sans: true })], spacing: { before: 200, after: 120 } }))
    for (const k of c.key_points) out.push(new Paragraph({ bullet: { level: 0 }, children: [run(k, { size: 23 })], spacing: { after: 80 } }))
  }
  if (c.caveat) out.push(new Paragraph({ children: [run(c.caveat, { italics: true, size: 20, color: '555555' })], spacing: { before: 200, after: 160 } }))
  if (p.source) out.push(para(ml ? `ഉറവിടം: ${p.source}` : `Source: ${p.source}`, { size: 18, color: '666666', sans: true }))

  if (p.slides?.length) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true, children: [run('Carousel slides (text)', { bold: true, size: 26, sans: true })], spacing: { after: 160 } }))
    p.slides.forEach((s, i) => {
      out.push(para(`Slide ${i + 1}${s.kicker ? ` · ${s.kicker}` : ''}`, { bold: true, size: 18, color: accent, sans: true, after: 40 }))
      if (s.headline) out.push(para(s.headline, { bold: true, size: 24, after: 40 }))
      if (s.body) out.push(para(s.body, { size: 22, after: 200 }))
    })
  }

  // Desk note: for the editor, not for publication.
  const g = p.gate
  const note = !g
    ? 'Desk note (not for publication): this version was not fact-checked.'
    : g.verdict === 'PASS'
      ? `Desk note (not for publication): every number and comparison was re-checked against the data by code. Result: PASS (${g.passed} checks passed${g.warned ? `, ${g.warned} to look at` : ''}).`
      : `Desk note (not for publication): the fact-check FAILED (${g.failed} problem${g.failed === 1 ? '' : 's'}). This file was exported anyway. Fix the problems before publishing.`
  out.push(new Paragraph({ border: { top: { style: 'single', size: 6, color: 'BBBBBB', space: 8 } }, spacing: { before: 360 }, children: [new TextRun({ text: note, size: 17, color: g?.verdict === 'FAIL' ? 'B00020' : '666666', font: 'Arial' })] }))

  const doc = new Document({ creator: 'Data Katha', title: c.headline, sections: [{ properties: { page: { margin: { top: 1200, bottom: 1200, left: 1300, right: 1300 } } }, children: out }] })
  download(`${slug(p.fileBase ?? c.headline)}-${p.lang}.docx`, await Packer.toBlob(doc))
}
