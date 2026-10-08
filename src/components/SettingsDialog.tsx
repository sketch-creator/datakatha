import { useEffect, useState } from 'react'
import { KeyRound, Loader2, PlayCircle, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Label, NativeSelect } from '@/components/ui/input'
import { listModels, pickModel, serverStatus, settings, type Mode, type ModelInfo } from '@/llm/client'
import { resetModelCache } from '@/llm/pipeline'
import { hasRecording, liveCount, saveRecording } from '@/llm/replay'
import { getState } from '@/state/store'
import { cn } from '@/lib/utils'

export function SettingsDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [mode, setMode] = useState<Mode>(settings.mode)
  const [key, setKey] = useState(settings.key)
  const [pass, setPass] = useState(settings.passcode)
  const [model, setModel] = useState(settings.model)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [server, setServer] = useState<{ serverKey: boolean; passcodeRequired: boolean } | null>(null)

  useEffect(() => {
    if (!open) return
    setMode(settings.mode)
    setKey(settings.key)
    setPass(settings.passcode)
    setModel(settings.model)
    setStatus('')
    void serverStatus().then(setServer)
  }, [open])

  async function test() {
    setBusy(true)
    setStatus('')
    try {
      if (mode === 'replay') {
        setStatus(hasRecording() ? 'Replay is ready for the sample dataset.' : 'Replay works only for the bundled CO₂ sample.')
        return
      }
      // Test the typed values without saving them; only Save writes to this browser.
      const ms = await listModels({ mode, key: key.trim(), passcode: pass.trim() })
      setModels(ms)
      const picked = pickModel(ms)
      setStatus(`Connected. ${ms.length} models available; auto-pick: ${picked}. Press Save to use it.`)
    } catch (e) {
      setStatus(`✗ ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  function save() {
    settings.mode = mode
    if (mode === 'own') settings.key = key.trim()
    if (mode === 'server') settings.passcode = pass.trim()
    settings.model = model
    resetModelCache()
    onSaved()
    onOpenChange(false)
  }

  const modes: { id: Mode; title: string; text: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: 'replay', title: 'Sample run', text: 'No key needed. Works for the CO₂ sample only: the writing was prepared in advance; the number checks run live.', icon: <PlayCircle className="size-4" /> },
    { id: 'own', title: 'My Gemini key', text: 'Your free AI Studio key. Kept in this browser only; calls go straight to Google.', icon: <KeyRound className="size-4" /> },
    { id: 'server', title: 'Demo passcode', text: server?.serverKey ? "Uses the owner's key on this server." : 'Not available: this server has no key set.', icon: <ShieldCheck className="size-4" />, disabled: server ? !server.serverKey : false },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Choose how the desk reaches Gemini. Numbers are always computed and checked in your browser.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {modes.map((m) => (
            <button
              key={m.id}
              disabled={m.disabled}
              onClick={() => setMode(m.id)}
              className={cn('flex gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed', mode === m.id ? 'border-brand bg-brand/10' : 'hover:bg-accent/50')}
            >
              <span className="mt-0.5 text-brand">{m.icon}</span>
              <span>
                <span className="block text-sm font-semibold">{m.title}</span>
                <span className="block text-xs text-muted-foreground">{m.text}</span>
              </span>
            </button>
          ))}
        </div>
        {mode === 'own' && (
          <div className="grid gap-2">
            <Label htmlFor="key">Gemini API key</Label>
            <div className="flex gap-2">
              <Input id="key" type="password" autoComplete="off" placeholder="AIza..." value={key} onChange={(e) => setKey(e.target.value)} />
              {settings.key && (
                <Button variant="outline" size="icon" title="Delete the saved key" onClick={() => { settings.key = ''; setKey(''); setStatus('Key deleted from this browser.') }}>
                  <Trash2 />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Get one free at aistudio.google.com → Get API key. Anyone using this browser profile can use it; delete it after a shared demo.</p>
          </div>
        )}
        {mode === 'server' && (
          <div className="grid gap-2">
            <Label htmlFor="pass">Demo passcode</Label>
            <Input id="pass" type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} />
          </div>
        )}
        {mode !== 'replay' && (
          <div className="grid gap-2">
            <Label htmlFor="model">Model</Label>
            <NativeSelect id="model" value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">Auto (newest Flash)</option>
              {models.map((m) => (
                <option key={m.name} value={m.name}>{m.displayName} ({m.name})</option>
              ))}
            </NativeSelect>
          </div>
        )}
        {status && <p className={cn('text-sm', status.startsWith('✗') ? 'text-destructive' : 'text-ok')}>{status}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={test} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Test connection</Button>
          <Button variant="brand" onClick={save} className="ml-auto">Save</Button>
        </div>
        {import.meta.env.DEV && (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <div className="mb-2 font-medium text-foreground">Dev: recording</div>
            {liveCount()} live answers this session.{' '}
            <Button size="sm" variant="secondary" onClick={async () => setStatus(await saveRecording(getState().dataset?.name ?? 'sample').catch((e) => `✗ ${e.message}`))}>
              <Save /> Save as replay for this file
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
