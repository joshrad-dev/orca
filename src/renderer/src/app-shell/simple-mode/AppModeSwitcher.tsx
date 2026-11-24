import type React from 'react'
import { Bot, Code2 } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { setAppShellMode, useAppShellMode, type AppShellMode } from './app-shell-mode-store'

const NO_DRAG_STYLE: React.CSSProperties & { WebkitAppRegion: 'no-drag' } = {
  WebkitAppRegion: 'no-drag'
}

export function AppModeSwitcher({ className }: { className?: string }): React.JSX.Element {
  const t = useTranslate()
  const mode = useAppShellMode()
  const options: readonly {
    mode: AppShellMode
    label: string
    icon: React.ComponentType<{ className?: string }>
  }[] = [
    { mode: 'simple', label: t('simpleBots.mode.bots', 'Bots'), icon: Bot },
    { mode: 'ide', label: t('simpleBots.mode.code', 'Code'), icon: Code2 }
  ]

  return (
    <div
      role="group"
      aria-label={t('simpleBots.mode.label', 'Workspace mode')}
      style={NO_DRAG_STYLE}
      className={cn(
        'inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-muted/60 p-0.5 text-xs',
        className
      )}
    >
      {options.map(({ mode: optionMode, label, icon: Icon }) => {
        const active = mode === optionMode
        return (
          <button
            key={optionMode}
            type="button"
            aria-pressed={active}
            onClick={() => setAppShellMode(optionMode)}
            className={cn(
              'inline-flex h-full items-center gap-1 rounded-[5px] px-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              active
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
