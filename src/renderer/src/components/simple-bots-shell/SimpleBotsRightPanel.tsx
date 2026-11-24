import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { Files, House, MessagesSquare, Plug } from 'lucide-react'
import { lazyWithRetry as lazy } from '@/app-shell/startup/lazy-with-retry'
import { SidebarToggleIcon } from '@/components/icons/SidebarToggleIcon'
import {
  clampRightSidebarPanelWidth,
  computeMaxRightSidebarPanelWidth,
  RIGHT_SIDEBAR_MIN_WIDTH
} from '@/components/right-sidebar/layout/right-sidebar-width'
import { RightSidebarGutterResizeProvider } from '@/components/right-sidebar/layout/right-sidebar-gutter-resize'
import { useWindowWidth } from '@/components/right-sidebar/layout/use-window-width'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useAppStore } from '@/store'
import type { Bot } from '../../../../shared/bot-types'
import { BotChatsSkeleton } from '../bots/BotChatsSkeleton'
import { SimpleChatFilesPanel } from './SimpleChatFilesPanel'

const BotActivityPanel = lazy(() => import('../bots/BotActivityPanel'))
const BotConnectorsPanel = lazy(() => import('../bots/BotConnectorsPanel'))
const BotChatsPanel = lazy(() => import('../bots/BotChatsPanel'))

const DRAG_STYLE: React.CSSProperties & { WebkitAppRegion: 'drag' } = { WebkitAppRegion: 'drag' }
const NO_DRAG_STYLE: React.CSSProperties & { WebkitAppRegion: 'no-drag' } = {
  WebkitAppRegion: 'no-drag'
}
const RIGHT_PANEL_DEFAULT_WIDTH = 360
const RIGHT_PANEL_COLLAPSE_THRESHOLD = 140

export type SimpleBotsRightTab = 'home' | 'connectors' | 'chats' | 'files'

export function SimpleBotsRightPanel({
  bot,
  activeTab,
  onTabChange,
  onClose
}: {
  bot: Bot
  activeTab: SimpleBotsRightTab
  onTabChange: (tab: SimpleBotsRightTab) => void
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const rightSidebarWidth = useAppStore((s) => s.rightSidebarWidth)
  const setRightSidebarWidth = useAppStore((s) => s.setRightSidebarWidth)
  const windowWidth = useWindowWidth()
  const maxWidth = computeMaxRightSidebarPanelWidth(windowWidth, 0)
  const renderedWidth = clampRightSidebarPanelWidth(rightSidebarWidth, windowWidth, 0)

  const rightTabs: readonly {
    id: SimpleBotsRightTab
    label: string
    icon: React.ComponentType<{ className?: string }>
  }[] = [
    { id: 'home', label: t('bots.items.tab', 'Home'), icon: House },
    { id: 'connectors', label: t('bots.connectors.tab', 'Connectors'), icon: Plug },
    { id: 'chats', label: t('bots.chats.title', 'Chats'), icon: MessagesSquare },
    { id: 'files', label: t('bots.files.tab', 'Files'), icon: Files }
  ]

  const { containerRef, isResizing, onResizeStart } = useSidebarResize<HTMLElement>({
    isOpen: true,
    width: renderedWidth,
    minWidth: RIGHT_SIDEBAR_MIN_WIDTH,
    maxWidth,
    deltaSign: -1,
    setWidth: setRightSidebarWidth,
    collapseThreshold: RIGHT_PANEL_COLLAPSE_THRESHOLD,
    onCollapse: onClose
  })

  const resizeHandleRef = useRef<HTMLDivElement | null>(null)
  const gutterHoverOwnerRef = useRef<HTMLElement | null>(null)
  const onResizeStartRef = useRef(onResizeStart)
  useLayoutEffect(() => {
    onResizeStartRef.current = onResizeStart
  })

  const gutterResize = useMemo(
    () => ({
      startResize: (event: React.MouseEvent) => onResizeStartRef.current(event),
      containerRef,
      handleRef: resizeHandleRef,
      hoverOwnerRef: gutterHoverOwnerRef
    }),
    [containerRef]
  )

  return (
    <RightSidebarGutterResizeProvider value={gutterResize}>
      <aside
        ref={containerRef}
        className="@container/right-panel relative flex shrink-0 flex-col border-l border-border bg-sidebar text-sidebar-foreground"
      >
        <div
          ref={resizeHandleRef}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('simpleBots.rightPanel.resize', 'Resize side panel')}
          onMouseDown={onResizeStart}
          onDoubleClick={() => setRightSidebarWidth(RIGHT_PANEL_DEFAULT_WIDTH)}
          className="peer absolute -left-[5px] top-0 z-20 h-full w-[9px] cursor-col-resize"
        />
        <div
          className={cn(
            'pointer-events-none absolute -left-px top-0 z-20 h-full w-px bg-transparent transition-colors peer-hover:bg-ring/50 peer-active:bg-ring data-[gutter-hover]:bg-ring/50',
            isResizing && 'bg-ring'
          )}
        />

        <div
          style={DRAG_STYLE}
          className="flex h-(--app-header-height) shrink-0 items-center justify-between gap-1 border-b border-border px-2"
        >
          <div
            role="tablist"
            aria-label={t('simpleBots.rightPanel.tabsLabel', 'Bot panels')}
            style={NO_DRAG_STYLE}
            className="flex min-w-0 items-center gap-0.5"
          >
            {rightTabs.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={label}
                  title={label}
                  onClick={() => onTabChange(id)}
                  className={cn(
                    'inline-flex h-7 min-w-0 shrink items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    active
                      ? 'bg-foreground/10 text-foreground'
                      : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground @max-[335px]/right-panel:w-7 @max-[335px]/right-panel:shrink-0 @max-[335px]/right-panel:px-0'
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span
                    className={cn('min-w-0 truncate', !active && '@max-[335px]/right-panel:hidden')}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                style={NO_DRAG_STYLE}
                onClick={onClose}
                aria-label={t('simpleBots.rightPanel.closeAria', 'Close right sidebar')}
                className="sidebar-toggle shrink-0"
              >
                <SidebarToggleIcon side="right" size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {t('simpleBots.rightPanel.close', 'Close sidebar')}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-right-sidebar-panel="">
          <Suspense fallback={activeTab === 'chats' ? <BotChatsSkeleton toolbar /> : null}>
            {activeTab === 'home' ? <BotActivityPanel /> : null}
            {activeTab === 'connectors' ? <BotConnectorsPanel /> : null}
            {activeTab === 'chats' ? <BotChatsPanel /> : null}
            {activeTab === 'files' ? <SimpleChatFilesPanel bot={bot} /> : null}
          </Suspense>
        </div>
      </aside>
    </RightSidebarGutterResizeProvider>
  )
}
