// "About your data": a plain summary on top of the story screen, with the
// column settings tucked behind "Adjust" for people who want them.
import { useState } from 'react'
import { Database, Info, Loader2, SlidersHorizontal } from 'lucide-react'
import type { Roles } from '@/engine'
import { startAnalysis } from '@/llm/pipeline'
import { plainNotes, plainSummary } from '@/engine/plain'
import { useStore } from '@/state/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Label, NativeSelect } from '@/components/ui/input'

export function AboutData() {
  const a = useStore((s) => s.analysis)!
  const intake = useStore((s) => s.intake)
  const busy = useStore((s) => s.intakeBusy)
  const [open, setOpen] = useState(false)
  const c = a.card
  const facts = [
    [c.entities.toLocaleString('en-US'), a.roles.entity === 'country' ? 'countries' : a.roles.entity],
    [`${c.periods.first}–${c.periods.last}`, `${c.periods.count} years`],
    [c.rows.toLocaleString('en-US'), 'rows'],
  ]
  return (
    <div className="mb-6 rounded-xl border bg-card/50 p-5">
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Database className="size-4 text-brand" /> About your data
          </div>
          {intake ? (
            <p className="max-w-3xl text-[15.5px] leading-relaxed">{intake.summary}</p>
          ) : busy ? (
            <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading it...</p>
          ) : (
            <p className="max-w-3xl text-[15.5px] leading-relaxed">{plainSummary(a)}</p>
          )}
        </div>
        <div className="flex gap-2">
          {facts.map(([v, l]) => (
            <div key={l} className="min-w-24 rounded-lg border bg-background/40 px-3 py-2 text-center">
              <div className="text-lg font-semibold tabular-nums">{v}</div>
              <div className="text-[11px] text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      </div>
      {(intake?.warnings?.length ? intake.warnings.map((w) => w.plain) : plainNotes(a)).length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {(intake?.warnings?.length ? intake.warnings.map((w) => w.plain) : plainNotes(a)).slice(0, 3).map((w, i) => (
            <div key={i} className="flex gap-2 rounded-lg bg-warn/8 p-3 text-[13px] leading-snug">
              <Info className="mt-0.5 size-4 shrink-0 text-warn" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Something read wrong?</span>
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="size-3" /> Adjust how the file is read
        </Button>
      </div>
      <AdjustDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

function AdjustDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const a = useStore((s) => s.analysis)!
  const ds = useStore((s) => s.dataset)!
  const cb = useStore((s) => s.codebook)
  const source = useStore((s) => s.source)
  const [roles, setRoles] = useState<Roles>(a.roles)
  const [busy, setBusy] = useState(false)
  const nums = ds.columns.filter((c) => ds.numeric.has(c))
  const texts = ds.columns.filter((c) => !ds.numeric.has(c))
  const periods = [...new Set(ds.rows.map((r) => r[a.roles.time]).filter((v): v is number => typeof v === 'number'))].sort((x, y) => x - y)
  const set = <K extends keyof Roles>(k: K, v: Roles[K]) => setRoles((r) => ({ ...r, [k]: v }))

  async function apply() {
    setBusy(true)
    onOpenChange(false)
    const fix = { ...roles, unit: roles.units[roles.value] ?? roles.unit, rateUnit: roles.rate ? roles.units[roles.rate] ?? '' : '', valueLabel: roles.labels[roles.value] ?? roles.value, rateLabel: roles.rate ? roles.labels[roles.rate] ?? roles.rate : '' }
    await startAnalysis(ds, cb ?? {}, source, fix)
    setBusy(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust how the file is read</DialogTitle>
          <DialogDescription>Most people never need this. Change a setting and the stories are found again.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="What each row is about (place, company...)"><NativeSelect value={roles.entity} onChange={(e) => set('entity', e.target.value)}>{texts.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Field>
          <Field label="The main number to look at"><NativeSelect value={roles.value} onChange={(e) => set('value', e.target.value)}>{nums.map((x) => <option key={x} value={x}>{roles.labels[x] ?? x}{roles.units[x] ? ` (${roles.units[x]})` : ''}</option>)}</NativeSelect></Field>
          <Field label="The same number per person (if there is one)"><NativeSelect value={roles.rate ?? ''} onChange={(e) => set('rate', e.target.value || null)}><option value="">none</option>{nums.map((x) => <option key={x} value={x}>{roles.labels[x] ?? x}</option>)}</NativeSelect></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Compare from year"><NativeSelect value={roles.base} onChange={(e) => set('base', +e.target.value)}>{periods.map((p) => <option key={p}>{p}</option>)}</NativeSelect></Field>
            <Field label="Up to year"><NativeSelect value={roles.latest} onChange={(e) => set('latest', +e.target.value)}>{periods.map((p) => <option key={p}>{p}</option>)}</NativeSelect></Field>
            <Field label={`Ignore small ones below (${roles.unit || 'units'})`}><Input type="number" value={roles.minValue} onChange={(e) => set('minValue', +e.target.value)} /></Field>
            <Field label="Per-person lists: at least this many people"><Input type="number" value={roles.minSize} onChange={(e) => set('minSize', +e.target.value)} /></Field>
          </div>
          <Button variant="brand" onClick={apply} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Find the stories again</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
