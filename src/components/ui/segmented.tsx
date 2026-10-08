import { cn } from '@/lib/utils'

/** A shadcn-style segmented control (toggle group with one value). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'default',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode; title?: string }[]
  className?: string
  size?: 'sm' | 'default'
}) {
  return (
    <div role="radiogroup" className={cn('inline-flex rounded-lg border bg-muted/50 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 font-medium transition-colors cursor-pointer',
            size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm',
            value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
