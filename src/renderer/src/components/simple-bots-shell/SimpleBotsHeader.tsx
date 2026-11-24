import type React from 'react'
import { Loader2, Plus } from 'lucide-react'
import { hasCustomTitleBar, hasMacTrafficLights } from '@/app-shell/chrome/app-window-chrome'
import type { AppChromeLayout } from '@/app-shell/chrome/use-app-chrome-layout'
import { AppModeSwitcher } from '@/app-shell/simple-mode/AppModeSwitcher'
import { SidebarToggleIcon } from '@/components/icons/SidebarToggleIcon'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type { Bot } from '../../../../shared/bot-types'
import { BotAvatar } from '../bots/BotAvatar'

const DRAG_STYLE: React.CSSProperties & { WebkitAppRegion: 'drag' } = { WebkitAppRegion: 'drag' }
const NO_DRAG_STYLE: React.CSSProperties & { WebkitAppRegion: 'no-drag' } = {
  WebkitAppRegion: 'no-drag'
}

export function SimpleBotsHeader({
  layout,
  activeBot,
  activeChatTitle,
  creatingChat,
  offline,
  rightSidebarOpen,
  onToggleSidebar,
  onNewChat,
  onToggleRightSidebar
}: {
  layout: AppChromeLayout
  activeBot: Bot | null
  activeChatTitle: string | null
  creatingChat: boolean
  offline: boolean
  rightSidebarOpen: boolean
  onToggleSidebar: () => void
  onNewChat: () => void
  onToggleRightSidebar: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const appName = t('auto.App.5096cbbc86', 'Orca')
  const openSidebarLabel = t('simpleBots.header.openSidebar', 'Open sidebar')

  return (
    <header
      style={DRAG_STYLE}
      className={cn(
        'flex h-(--app-header-height) shrink-0 items-center justify-between gap-2 border-b border-border pr-3',
        layout.sidebarOpen ? 'pl-3' : 'pl-0'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {!layout.sidebarOpen ? (
          <div className="flex shrink-0 items-center">
            {hasMacTrafficLights && !layout.isFullScreen ? (
              <div className="titlebar-traffic-light-pad" />
            ) : (
              <div className="pl-2" />
            )}
            {!hasCustomTitleBar && layout.showTitlebarAppName ? (
              <div className="titlebar-app-name" aria-label={appName}>
                <span className="titlebar-app-name-main">{appName}</span>
              </div>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  style={NO_DRAG_STYLE}
                  onClick={onToggleSidebar}
                  aria-label={openSidebarLabel}
                  className="sidebar-toggle"
                >
                  <SidebarToggleIcon side="left" size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {openSidebarLabel}
              </TooltipContent>
            </Tooltip>
            <AppModeSwitcher className="ml-1.5" />
          </div>
        ) : null}

        {activeBot ? (
          <div className="flex min-w-0 items-center gap-2">
            <BotAvatar bot={activeBot} className="size-5 rounded-md" />
            <span className="truncate text-[13px] font-semibold text-foreground">
              {activeBot.name}
            </span>
            {activeChatTitle ? (
              <span className="truncate text-xs text-muted-foreground">/ {activeChatTitle}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-[13px] font-semibold text-foreground">
            {t('simpleBots.mode.bots', 'Bots')}
          </span>
        )}
      </div>

      <div style={NO_DRAG_STYLE} className="flex shrink-0 items-center gap-1.5">
        {activeBot ? (
          <Button
            variant="outline"
            size="xs"
            disabled={creatingChat || offline}
            onClick={onNewChat}
            className="h-7"
          >
            {creatingChat ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            <span>{t('bots.chats.new', 'New chat')}</span>
          </Button>
        ) : null}

        {activeBot && !rightSidebarOpen ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleRightSidebar}
                aria-label={t('simpleBots.header.openRightSidebar', 'Open right sidebar')}
                className="sidebar-toggle"
              >
                <SidebarToggleIcon side="right" size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {openSidebarLabel}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </header>
  )
}
