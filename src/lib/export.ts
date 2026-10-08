// Exports: carousel PNGs (zip), article HTML, plain text for pasting into a CMS.
import JSZip from 'jszip'
import { toPng } from 'html-to-image'
import type { StoryContent } from '@/llm/content'

export function download(name: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 1000)
}

/** Only a draft that passed the fact-check may be exported, unless the user chose "Export anyway". */
export function canExport(gate: { verdict: 'PASS' | 'FAIL' } | undefined, anyway = false): boolean {
  return gate?.verdict === 'PASS' || (anyway && Boolean(gate))
}

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'story'
}

/** Render every node to a full-size PNG and zip them. */
export async function zipSlides(nodes: HTMLElement[], base: string, onProgress?: (i: number) => void) {
  await document.fonts.ready
  const zip = new JSZip()
  for (let i = 0; i < nodes.length; i++) {
    onProgress?.(i)
    const url = await toPng(nodes[i], { pixelRatio: 1, cacheBust: true })
    zip.file(`${base}-${String(i + 1).padStart(2, '0')}.png`, url.split(',')[1], { base64: true })
  }
  download(`${base}-carousel.zip`, await zip.generateAsync({ type: 'blob' }))
}

export function articleText(c: StoryContent, source: string, lang: 'en' | 'ml') {
  return [
    c.headline,
    c.dek,
    '',
    ...c.body.flatMap((p) => [p, '']),
    lang === 'ml' ? 'പ്രധാന വസ്തുതകൾ:' : 'Key points:',
    ...c.key_points.map((k) => `- ${k}`),
    '',
    c.caveat,
    '',
    lang === 'ml' ? `ഉറവിടം: ${source}` : `Source: ${source}`,
  ].join('\n')
}

export function articleHtml(node: HTMLElement, title: string, lang: 'en' | 'ml') {
  const fonts =
    'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400&family=Inter:wght@400..800&family=Noto+Serif+Malayalam:wght@400..700&family=Noto+Sans+Malayalam:wght@400..700&family=Manjari:wght@400;700&display=swap'
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/</g, '&lt;')}</title><link rel="stylesheet" href="${fonts}"><style>body{margin:0;display:flex;justify-content:center;background:#e9e8e3}article{max-width:100%}svg{max-width:100%;height:auto}</style></head><body>${node.outerHTML}</body></html>`
  download(`${slug(title) || 'article'}-${lang}.html`, new Blob([html], { type: 'text/html' }))
}
