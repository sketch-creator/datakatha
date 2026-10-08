import { useState } from 'react'
import { Newspaper, PanelRightOpen, PlayCircle, Settings, Zap } from 'lucide-react'
import { resetState, setState, useStore } from '@/state/store'
import { settings } from '@/llm/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SettingsDialog } from '@/components/SettingsDialog'
import { UnderTheHood } from '@/components/UnderTheHood'
import { Upload } from '@/screens/Upload'
import { Board } from '@/screens/Board'
import { Studio } from '@/screens/Studio'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 'upload', label: 'Your data' },
  { id: 'board', label: 'Stories' },
  { id: 'studio', label: 'Make it' },
] as const

export default function App() {
  const phase = useStore((s) => s.phase)
  const error = useStore((s) => s.error)
  const hasAnalysis = useStore((s) => Boolean(s.analysis))
  const hasPick = useStore((s) => Boolean(s.pick))
  const [panel, setPanel] = useState(true)
  const [openSettings, setOpenSettings] = useState(false)
  // Stays on Sample run until a live mode is chosen and saved in Settings,
  // even when this server has a key (the sample must not call the model unasked).
  const [mode, setMode] = useState(settings.mode)

  const idx = STEPS.findIndex((s) => s.id === phase)
  const reachable = (id: string) => id === 'upload' || (id === 'board' && hasAnalysis) || (id === 'studio' && hasPick)

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4">
        <button className="flex items-center gap-2 cursor-pointer" onClick={() => resetState()} title="Start again">
          <span className="grid size-8 place-items-center rounded-lg bg-brand/15 text-brand">
            <Newspaper className="size-4.5" />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">Data Katha</span>
        </button>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              disabled={!reachable(s.id)}
              onClick={() => setState({ phase: s.id })}
              className={cn('flex items-center gap-2 rounded-md px-2.5 py-1 text-sm transition-colors cursor-pointer disabled:cursor-default', i === idx ? 'bg-secondary text-foreground' : i < idx ? 'text-foreground/80 hover:bg-accent' : 'text-muted-foreground')}
            >
              <span className={cn('grid size-5 place-items-center rounded-full text-[11px] tabular-nums', i <= idx ? 'bg-brand text-zinc-950' : 'bg-muted')}>{i + 1}</span>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={mode === 'replay' ? 'warn' : 'ok'} className="hidden sm:inline-flex">
            {mode === 'replay' ? <PlayCircle /> : <Zap />}
            {mode === 'replay' ? 'Sample run (no key needed)' : mode === 'server' ? 'Live AI · demo key' : 'Live AI · your key'}
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => setOpenSettings(true)} title="Settings">
            <Settings />
          </Button>
          {!panel && (
            <Button variant="outline" size="sm" onClick={() => setPanel(true)}>
              <PanelRightOpen /> How this works
            </Button>
          )}
        </div>
      </header>
      {error && (
        <div className="flex items-center gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
          <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => setState({ error: undefined })}>Dismiss</Button>
          {mode === 'replay' && <Button size="sm" variant="outline" className="h-7" onClick={() => setOpenSettings(true)}>Add a free Gemini key</Button>}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <main className={cn('min-w-0 flex-1', phase === 'studio' ? 'overflow-hidden' : 'overflow-y-auto scroll-thin')}>
          {phase === 'upload' && <Upload />}
          {phase === 'board' && <Board />}
          {phase === 'studio' && <Studio />}
        </main>
        {panel && (
          <div className="hidden w-[400px] shrink-0 lg:block">
            <UnderTheHood onClose={() => setPanel(false)} />
          </div>
        )}
      </div>
      <SettingsDialog open={openSettings} onOpenChange={setOpenSettings} onSaved={() => setMode(settings.mode)} />
    </div>
  )
}
