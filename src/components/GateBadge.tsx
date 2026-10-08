import { CheckCircle2, CircleAlert, Loader2, XCircle } from 'lucide-react'
import type { GateItem, GateResult } from '@/engine/gate'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function GateBadge({ gate, label, fixed, busy }: { gate?: GateResult; label: string; fixed?: boolean; busy?: boolean }) {
  if (busy) return <Badge variant="outline" className="text-muted-foreground"><Loader2 className="animate-spin" />{label}</Badge>
  if (!gate) return <Badge variant="outline" className="text-muted-foreground">{label} —</Badge>
  const checked = gate.passed + gate.failed
  return (
    <Badge variant={gate.verdict === 'PASS' ? 'ok' : 'fail'} title={`${gate.passed} passed, ${gate.failed} failed, ${gate.warned} to check by hand`}>
      {gate.verdict === 'PASS' ? <CheckCircle2 /> : <XCircle />}
      {label} {gate.passed}/{checked} checked{fixed ? ' · auto-fixed' : ''}
    </Badge>
  )
}

const icon = (s: GateItem['status']) =>
  s === 'pass' ? <CheckCircle2 className="size-4 text-ok shrink-0" /> : s === 'fail' ? <XCircle className="size-4 text-destructive shrink-0" /> : <CircleAlert className="size-4 text-warn shrink-0" />

export function GateList({ gate, extra = [], compact }: { gate: GateResult; extra?: GateItem[]; compact?: boolean }) {
  const items = [...gate.items, ...extra].sort((a, b) => order(a.status) - order(b.status))
  return (
    <div className="space-y-1">
      <div className={cn('flex items-center gap-2 text-[15px] font-semibold', gate.verdict === 'PASS' ? 'text-ok' : 'text-destructive')}>
        {gate.verdict === 'PASS' ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
        {gate.verdict === 'PASS'
          ? `All ${gate.passed} numbers and comparisons match the data.`
          : `${gate.failed} of ${gate.passed + gate.failed} don't match the data. Fix them before publishing.`}
      </div>
      {gate.warned + extra.length > 0 && <div className="text-xs text-warn">{gate.warned + extra.length} small thing{gate.warned + extra.length > 1 ? 's' : ''} for a person to look at (marked below).</div>}
      <div className="pt-1 text-[11px] text-muted-foreground">Each line: where it appears, what it says, and the figure worked out from the data.</div>
      <ul className={cn('divide-y divide-border rounded-md border text-xs', compact && 'max-h-72 overflow-auto scroll-thin')}>
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 px-2.5 py-1.5">
            {icon(it.status)}
            <div className="min-w-0">
              <div className="flex flex-wrap gap-x-2">
                <span className="text-muted-foreground">{it.where}</span>
                <span className="font-medium break-words" lang={gate.lang}>{it.claim}</span>
              </div>
              <div className="text-muted-foreground break-words">{it.detail}</div>
              {it.fix && <div className="text-warn break-words">Fix: {it.fix}</div>}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground pt-1">This checks the writing against the data. It can't tell if the data itself is wrong, so an editor still signs off.</p>
    </div>
  )
}

const order = (s: GateItem['status']) => (s === 'fail' ? 0 : s === 'warn' ? 1 : 2)
