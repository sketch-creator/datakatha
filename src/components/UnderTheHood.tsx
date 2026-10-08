// "How this works": the desk's six stages in plain words, who does each one
// (computer code for the maths, AI for the words), and the exact instructions
// one click away for anyone who wants to see them.
import { useState } from 'react'
import { Calculator, Check, ChevronDown, ChevronRight, CircleDashed, FileText, Loader2, PanelRightClose, PenLine, ScanSearch, ShieldCheck, Sparkles, Trophy, X } from 'lucide-react'
import { useStages, type Stage } from '@/state/stages'
import { useStore, type Step } from '@/state/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GateList } from './GateBadge'
import { cn } from '@/lib/utils'

const ICON: Record<string, React.ReactNode> = {
  read: <FileText className="size-4" />,
  understand: <Sparkles className="size-4" />,
  look: <ScanSearch className="size-4" />,
  pick: <Trophy className="size-4" />,
  write: <PenLine className="size-4" />,
  check: <ShieldCheck className="size-4" />,
}

export function UnderTheHood({ onClose }: { onClose: () => void }) {
  const stages = useStages()
  const steps = useStore((s) => s.steps)
  const [open, setOpen] = useState<Stage | null>(null)
  const [log, setLog] = useState(false)
  return (
    <aside className="flex h-full w-full flex-col border-l bg-card/40">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="font-semibold">How this works</div>
        <Button variant="ghost" size="icon" className="ml-auto size-7" onClick={onClose} title="Hide panel">
          <PanelRightClose className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 border-b px-4 py-3">
        <Who who="code" big />
        <Who who="ai" big />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 scroll-thin">
        <ol className="relative">
          {stages.map((st, i) => (
            <li key={st.id} className="relative flex gap-3 pb-5">
              {i < stages.length - 1 && <span className={cn('absolute top-9 left-[17px] bottom-0 w-px', st.status === 'done' ? 'bg-ok/40' : 'bg-border')} />}
              <Dot stage={st} />
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('font-semibold', st.status === 'waiting' && 'text-muted-foreground')}>{st.title}</span>
                  <Who who={st.who} />
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{st.plain}</p>
                {st.stat && <div className={cn('mt-1.5 inline-block rounded-md px-2 py-1 text-[13px] font-semibold tabular-nums', st.id === 'check' ? 'bg-ok/12 text-ok' : 'bg-secondary')}>{st.stat}</div>}
                {st.steps.length > 0 && (
                  <button className="mt-1.5 block text-[12px] text-brand hover:underline cursor-pointer" onClick={() => setOpen(st)}>
                    {st.who === 'ai' ? 'See the exact instructions →' : st.id === 'check' ? 'See every check →' : 'See what the code found →'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <button onClick={() => setLog((l) => !l)} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
          {log ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} Technical log ({steps.length} steps)
        </button>
        {log && (
          <div className="mt-2 space-y-1.5">
            {steps.map((s, i) => (
              <div key={s.id} className="rounded-md border bg-background/40 px-2.5 py-1.5 text-[11.5px]">
                <span className="tabular-nums text-muted-foreground">{String(i + 1).padStart(2, '0')} </span>
                <span className="font-mono text-muted-foreground">{s.skill}</span> · {s.title}
                <span className="text-muted-foreground"> · {s.source}{s.ms !== undefined ? ` · ${(s.ms / 1000).toFixed(1)} s` : ''}</span>
                {s.note && <div className="text-muted-foreground">{s.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      <StageDialog stage={open} onClose={() => setOpen(null)} />
    </aside>
  )
}

function Dot({ stage }: { stage: Stage }) {
  const base = 'relative z-10 grid size-9 shrink-0 place-items-center rounded-full border'
  if (stage.status === 'working') return <span className={cn(base, 'border-brand bg-brand/15 text-brand')}><Loader2 className="size-4 animate-spin" /></span>
  if (stage.status === 'error') return <span className={cn(base, 'border-destructive bg-destructive/15 text-destructive')}><X className="size-4" /></span>
  if (stage.status === 'done')
    return (
      <span className={cn(base, 'border-ok/50 bg-ok/12 text-ok')}>
        {ICON[stage.id]}
        <Check className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full bg-ok p-0.5 text-zinc-950" />
      </span>
    )
  return <span className={cn(base, 'bg-muted/40 text-muted-foreground')}>{stage.status === 'waiting' ? <CircleDashed className="size-4" /> : ICON[stage.id]}</span>
}

function Who({ who, big }: { who: 'code' | 'ai'; big?: boolean }) {
  const code = who === 'code'
  if (!big)
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-medium', code ? 'bg-sky-500/15 text-sky-300' : 'bg-violet-500/15 text-violet-300')}>
        {code ? <Calculator className="size-3" /> : <Sparkles className="size-3" />}
        {code ? 'Code' : 'AI'}
      </span>
    )
  return (
    <div className={cn('rounded-lg p-2.5', code ? 'bg-sky-500/10' : 'bg-violet-500/10')}>
      <div className={cn('flex items-center gap-1.5 text-[13px] font-semibold', code ? 'text-sky-300' : 'text-violet-300')}>
        {code ? <Calculator className="size-3.5" /> : <Sparkles className="size-3.5" />}
        {code ? 'Code' : 'AI'}
      </div>
      <div className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{code ? 'Does all the maths. Exact, every time.' : 'Writes the words. Never trusted with numbers.'}</div>
    </div>
  )
}

function StageDialog({ stage, onClose }: { stage: Stage | null; onClose: () => void }) {
  const [i, setI] = useState(0)
  const steps = stage?.steps ?? []
  const step: Step | undefined = steps[Math.min(i, steps.length - 1)]
  return (
    <Dialog open={!!stage} onOpenChange={(o) => { if (!o) { onClose(); setI(0) } }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{stage?.title}</DialogTitle>
          <DialogDescription>
            {stage?.who === 'ai'
              ? 'These are the exact instructions the AI was given, the facts it was sent, and what it wrote back.'
              : stage?.id === 'check'
                ? 'Every number and comparison in the writing, worked out again from the file.'
                : 'What the code worked out from the file. No AI is involved in this step.'}
          </DialogDescription>
        </DialogHeader>
        {steps.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {steps.map((s, k) => (
              <button key={s.id} onClick={() => setI(k)} className={cn('rounded-md border px-2 py-1 text-xs cursor-pointer', k === i ? 'border-brand bg-brand/10' : 'text-muted-foreground hover:bg-accent')}>
                {s.title.length > 48 ? `${s.title.slice(0, 46)}…` : s.title}
              </button>
            ))}
          </div>
        )}
        {step && (
          <div className="space-y-3">
            {step.note && <p className="text-xs text-warn">{step.note}</p>}
            {step.gate && step.skill === 'fact-check-gate' ? (
              <GateList gate={step.gate} compact />
            ) : (
              <>
                {step.system && <Block title="1. The instructions" text={step.system} />}
                {step.user && <Block title="2. What it was sent (the worked-out facts)" text={step.user} />}
                {step.response && <Block title={step.system ? '3. What came back' : 'What the code found'} text={pretty(step.response)} />}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{title}</div>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted/60 p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap break-words font-mono scroll-thin">{text}</pre>
    </div>
  )
}

function pretty(t: string) {
  try {
    return JSON.stringify(JSON.parse(t), null, 1)
  } catch {
    return t
  }
}
