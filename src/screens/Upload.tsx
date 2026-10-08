import { useRef, useState } from 'react'
import { ArrowRight, FileSpreadsheet, Loader2, Sparkles, Upload as UploadIcon, BookOpen, Download } from 'lucide-react'
import { parseCodebook, parseCsv, type Codebook, type Dataset } from '@/engine'
import { startAnalysis } from '@/llm/pipeline'
import { setState, useStore, type Format } from '@/state/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'

const SAMPLE = {
  data: '/sample/co2_by_country_1990_2024.csv',
  codebook: '/sample/codebook.csv',
  source: 'Global Carbon Budget (2025) via Our World in Data',
}

// Files people can save and upload themselves, to see the app work on a file it has not seen.
const DOWNLOADS = [
  { file: 'co2_by_country_1990_2024.csv', title: 'CO₂ by country, 1990–2024', note: '218 countries. The same file as the sample. Source: Global Carbon Budget (2025) via Our World in Data.' },
  { file: 'codebook.csv', title: 'Codebook for the CO₂ files', note: 'Says what each column means and its unit. Add it under "Optional details".' },
  { file: 'district_cases_practice.csv', title: 'Practice file: district cases', note: 'Made-up numbers with six planted mistakes. Upload it and see which ones the app catches.' },
]

export function Upload() {
  const angle = useStore((s) => s.angle)
  const formatPref = useStore((s) => s.formatPref)
  const [ds, setDs] = useState<Dataset | null>(null)
  const [cb, setCb] = useState<Codebook>({})
  const [cbName, setCbName] = useState('')
  const [source, setSource] = useState('')
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const cbRef = useRef<HTMLInputElement>(null)

  async function readData(f: File) {
    setErr('')
    if (f.size > 25 * 1024 * 1024) return setErr('That file is over 25 MB. Trim it to the columns you need.')
    const d = parseCsv(await f.text(), f.name)
    if (!d.rows.length || d.columns.length < 2) return setErr('Could not read rows from that file. Is it a CSV with a header row?')
    setDs(d)
  }

  async function sample() {
    setBusy(true)
    const [d, c] = await Promise.all([fetch(SAMPLE.data).then((r) => r.text()), fetch(SAMPLE.codebook).then((r) => r.text())])
    setDs(parseCsv(d, 'co2_by_country_1990_2024.csv'))
    setCb(parseCodebook(c))
    setCbName('codebook.csv')
    setSource(SAMPLE.source)
    setBusy(false)
  }

  async function go() {
    if (!ds) return
    setBusy(true)
    setErr('')
    try {
      await startAnalysis(ds, cb, source.trim())
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-5xl font-semibold tracking-tight">Drop a dataset. Get checked stories.</h1>
        <p className="mt-3 text-muted-foreground">
          Give it a spreadsheet. It finds the stories, including ones people usually miss, writes them in English and Malayalam, and checks every number against your data.
        </p>
      </div>
      <Card className="gap-6">
        <CardContent className="space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              const f = e.dataTransfer.files[0]
              if (f) void readData(f)
            }}
            onClick={() => fileRef.current?.click()}
            className={cn('flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors', drag ? 'border-brand bg-brand/10' : 'hover:border-ring/60 hover:bg-accent/30')}
          >
            {ds ? (
              <>
                <FileSpreadsheet className="size-8 text-ok" />
                <div className="text-center">
                  <div className="font-medium">{ds.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {ds.rows.length.toLocaleString('en-US')} rows · {ds.columns.length} columns · {ds.sizeKB.toLocaleString('en-US')} KB
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Click to choose a different file</span>
              </>
            ) : (
              <>
                <UploadIcon className="size-8 text-muted-foreground" />
                <div className="text-center">
                  <div className="font-medium">Drop a CSV here, or click to choose</div>
                  <div className="text-sm text-muted-foreground">One row per place (or company, school...) per year works best</div>
                </div>
              </>
            )}
            <input ref={fileRef} type="file" accept=".csv,.tsv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && readData(e.target.files[0])} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <Button variant="secondary" onClick={sample} disabled={busy}>
              <Sparkles /> Try the CO₂ sample
            </Button>
            <span className="text-muted-foreground">Carbon emissions of 218 countries, 1990–2024. Works without any setup.</span>
          </div>
          <details className="group rounded-lg border bg-background/30 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">
              Optional details <span className="font-normal text-muted-foreground">(the sample fills these in for you)</span>
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Codebook</Label>
                <p className="text-xs text-muted-foreground">A small file that says what each column means and its unit, like "co2 = million tonnes". Helps the stories use the right units.</p>
                <Button variant="outline" className="justify-start font-normal" onClick={() => cbRef.current?.click()}>
                  <BookOpen /> {cbName || 'Add a codebook'}
                </Button>
                <input
                  ref={cbRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setCb(parseCodebook(await f.text()))
                    setCbName(f.name)
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="src">Source</Label>
                <p className="text-xs text-muted-foreground">Who published the data. It is printed under every chart and story.</p>
                <Input id="src" placeholder="e.g. Global Carbon Budget 2025" value={source} onChange={(e) => setSource(e.target.value)} />
              </div>
            </div>
          </details>
          <details className="group rounded-lg border bg-background/30 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">
              Download files to try <span className="font-normal text-muted-foreground">(save one, then drop it in above)</span>
            </summary>
            <ul className="mt-4 grid gap-3">
              {DOWNLOADS.map((d) => (
                <li key={d.file} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-muted-foreground">{d.note}</div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <a href={`/sample/${d.file}`} download={d.file}>
                      <Download /> CSV
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </details>
          <div className="grid gap-2">
            <Label htmlFor="angle">
              Already have a story idea? <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="angle" placeholder='e.g. "Is China now dirtier per person than Europe?"' value={angle} onChange={(e) => setState({ angle: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Label>Format</Label>
            <Segmented<Format | 'later'>
              value={formatPref}
              onChange={(v) => setState({ formatPref: v })}
              options={[
                { value: 'later', label: 'Decide later' },
                { value: 'article', label: 'Article' },
                { value: 'carousel', label: 'Carousel' },
              ]}
            />
            <span className="text-xs text-muted-foreground">Every format comes in English and മലയാളം</span>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button size="lg" variant="brand" className="w-full" disabled={!ds || busy} onClick={go}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Find the stories <ArrowRight />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
