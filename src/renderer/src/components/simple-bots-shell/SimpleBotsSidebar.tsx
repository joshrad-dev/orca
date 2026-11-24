import { useState } from 'react'
import {
  Bot as BotIcon,
  HelpCircle,
  LayoutTemplate,
  Plus,
  Search,
  Settings,
  Smartphone
} from 'lucide-react'
import { SidebarToggleIcon } from '@/components/icons/SidebarToggleIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useAppStore } from '@/store'
import { hasCustomTitleBar, hasMacTrafficLights } from '@/app-shell/chrome/app-window-chrome'
import type { AppChromeLayout } from '@/app-shell/chrome/use-app-chrome-layout'
import { AppModeSwitcher } from '@/app-shell/simple-mode/AppModeSwitcher'
import type { Bot } from '../../../../shared/bot-types'
import { showOnboardingFromRenderer } from '../onboarding/show-onboarding-event'
import { openBotTemplates } from '../bots/templates/bot-templates-open'
import { SimpleBotSidebarGroup } from './SimpleBotSidebarGroup'

const DRAG_STYLE: React.CSSProperties & { WebkitAppRegion: 'drag' } = { WebkitAppRegion: 'drag' }
const NO_DRAG_STYLE: React.CSSProperties & { WebkitAppRegion: 'no-drag' } = {
  WebkitAppRegion: 'no-drag'
}
const LEFT_SIDEBAR_MIN_WIDTH = 220
const LEFT_SIDEBAR_MAX_WIDTH = 500
const LEFT_SIDEBAR_DEFAULT_WIDTH = 264
const LEFT_SIDEBAR_COLLAPSE_THRESHOLD = 130

export function SimpleBotsSidebar({
  layout,
  bots,
  activeWorkspaceId,
  activeSessionId,
  onSelectBot,
  onNewBot
}: {
  layout: AppChromeLayout
  bots: readonly Bot[]
  activeWorkspaceId: string | null
  activeSessionId: string | null
  onSelectBot: (bot: Bot) => void
  onNewBot: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openMobilePage = useAppStore((s) => s.openMobilePage)
  const activeView = useAppStore((s) => s.activeView)
  const [searchQuery, setSearchQuery] = useState('')

  const appName = t('auto.App.5096cbbc86', 'Orca')
  const toggleSidebarLabel = t('auto.App.e4b9e7dff7', 'Toggle sidebar')
  const searchPlaceholder = t('simpleBots.sidebar.search', 'Search bots and chats')

  const { containerRef, isResizing, onResizeStart } = useSidebarResize<HTMLElement>({
    isOpen: layout.sidebarOpen,
    width: sidebarWidth,
    minWidth: LEFT_SIDEBAR_MIN_WIDTH,
    maxWidth: LEFT_SIDEBAR_MAX_WIDTH,
    deltaSign: 1,
    setWidth: setSidebarWidth,
    collapseThreshold: LEFT_SIDEBAR_COLLAPSE_THRESHOLD,
    onCollapse: toggleSidebar
  })

  return (
    <aside
      ref={containerRef}
      style={layout.leftSidebarStyle}
      className="relative flex shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground"
    >
      <div style={DRAG_STYLE} className="flex h-(--app-header-height) shrink-0 items-center pr-2">
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
              onClick={toggleSidebar}
              aria-label={toggleSidebarLabel}
              className="sidebar-toggle"
            >
              <SidebarToggleIcon side="left" size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {toggleSidebarLabel}
          </TooltipContent>
        </Tooltip>
        <AppModeSwitcher className="ml-1.5" />
      </div>

      <div className="space-y-2 px-2.5 pt-1 pb-2">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onNewBot} className="flex-1 justify-start">
            <Plus className="size-3.5" />
            <span>{t('simpleBots.sidebar.newBot', 'New bot')}</span>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => openBotTemplates()}
                aria-label={t('simpleBots.sidebar.browseTemplatesAria', 'Browse bot templates')}
                className="shrink-0"
              >
                <LayoutTemplate className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              {t('simpleBots.sidebar.browseTemplates', 'Browse templates')}
            </TooltipContent>
          </Tooltip>
        </div>

        {bots.length > 0 ? (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              density="compact"
              inset="leadingIcon"
            />
          </div>
        ) : null}
      </div>

      <div className="worktree-sidebar-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {bots.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <BotIcon className="mb-2.5 size-7 text-muted-foreground/50" />
            <p className="text-[13px] font-medium text-foreground">
              {t('simpleBots.sidebar.emptyTitle', 'No bots yet')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                'simpleBots.sidebar.emptyBody',
                'Create a bot to start chatting, scheduling reminders, or automating tasks.'
              )}
            </p>
          </div>
        ) : (
          bots.map((bot) => (
            <SimpleBotSidebarGroup
              key={`${bot.hostId}:${bot.id}`}
              bot={bot}
              activeWorkspaceId={activeWorkspaceId}
              activeSessionId={activeSessionId}
              searchQuery={searchQuery}
              onSelectChat={onSelectBot}
            />
          ))
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-1 border-t border-border px-2 py-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant={activeView === 'settings' ? 'secondary' : 'ghost'}
            size="xs"
            onClick={openSettingsPage}
          >
            <Settings className="size-3.5" />
            <span>{t('bots.panel.settings.title', 'Settings')}</span>
          </Button>

          <Button
            variant={activeView === 'mobile' ? 'secondary' : 'ghost'}
            size="xs"
            onClick={openMobilePage}
          >
            <Smartphone className="size-3.5" />
            <span>{t('simpleBots.sidebar.mobile', 'Mobile')}</span>
          </Button>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t('simpleBots.sidebar.openOnboarding', 'Open onboarding')}
              onClick={() => void showOnboardingFromRenderer()}
            >
              <HelpCircle className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {t('auto.components.sidebar.SidebarSettingsHelpMenu.b7e4d2a19c', 'Onboarding')}
          </TooltipContent>
        </Tooltip>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('simpleBots.sidebar.resize', 'Resize bots sidebar')}
        onMouseDown={onResizeStart}
        onDoubleClick={() => setSidebarWidth(LEFT_SIDEBAR_DEFAULT_WIDTH)}
        className="peer absolute -right-[5px] top-0 z-20 h-full w-[9px] cursor-col-resize"
      />
      <div
        className={cn(
          'pointer-events-none absolute -right-px top-0 z-20 h-full w-px bg-transparent transition-colors peer-hover:bg-ring/50 peer-active:bg-ring',
          isResizing && 'bg-ring'
        )}
      />
    </aside>
  )
}
