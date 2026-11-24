import { Activity, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot as BotIcon, LayoutTemplate, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { lazyWithRetry as lazy } from '@/app-shell/startup/lazy-with-retry'
import { hasMacTrafficLights } from '@/app-shell/chrome/app-window-chrome'
import type { AppChromeLayout } from '@/app-shell/chrome/use-app-chrome-layout'
import { ActivityPortalContainer } from '@/components/ui/activity-portal-container'
import { Button } from '@/components/ui/button'
import { RecoverableRenderErrorBoundary } from '@/components/error-boundaries/RecoverableRenderErrorBoundary'
import { useTranslate } from '@/i18n/use-translate'
import { openBotHomeTab, startBotSession, useBots } from '@/lib/bot-catalog'
import { selectFocusedChatTab } from '@/lib/focused-chat-workers'
import { activateAiVaultStructuredSession } from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import { useBotHostOffline } from '@/lib/bot-host-views'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { useAppStore } from '@/store'
import type { Bot } from '../../../../shared/bot-types'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import { isStructuredTab } from '../../../../shared/agent-session/view/structured-agent-session-tab'
import { botErrorMessage } from '../bots/bot-presentation'
import { NewBotDialog } from '../bots/NewBotDialog'
import { openBotTemplates } from '../bots/templates/bot-templates-open'
import { useBotShareReceiveRequest } from '../bots/sharing/bot-share-receive-open'
import { useBotOwnChatTree } from '../bots/use-bot-chat-tree'
import NativeChatView from '../native-chat/NativeChatView'
import { NativeChatComposerEditorOwner } from '../native-chat/composer/editor/native-chat-composer-editor-owner'
import { NativeChatHostOutageOwner } from '../native-chat/host-access/native-chat-host-outage-owner'
import { NativeChatPaneLifetime } from '../native-chat/pane/ownership/native-chat-pane-lifetime'
import { SimpleBotsHeader } from './SimpleBotsHeader'
import { SimpleBotsRightPanel, type SimpleBotsRightTab } from './SimpleBotsRightPanel'
import { SimpleBotsSidebar } from './SimpleBotsSidebar'
import { SimpleSidebarEdgeExpandHandle } from './SimpleSidebarEdgeExpandHandle'

const Settings = lazy(() => import('../settings/Settings'))
const MobilePage = lazy(() => import('../mobile/MobilePage'))
const BotTemplatesDialog = lazy(() => import('../bots/templates/BotTemplatesDialog'))
const BotShareReceiveFlow = lazy(() =>
  import('../bots/sharing/BotShareReceiveFlow').then((module) => ({
    default: module.BotShareReceiveFlow
  }))
)

const DRAG_STYLE: React.CSSProperties & { WebkitAppRegion: 'drag' } = { WebkitAppRegion: 'drag' }
const NO_DRAG_STYLE: React.CSSProperties & { WebkitAppRegion: 'no-drag' } = {
  WebkitAppRegion: 'no-drag'
}

function SimpleBotsModals({
  newBotOpen,
  onNewBotOpenChange,
  onBotCreated
}: {
  newBotOpen: boolean
  onNewBotOpenChange: (open: boolean) => void
  onBotCreated: (bot: Bot) => void
}): React.JSX.Element {
  const templatesOpen = useAppStore((s) => s.activeModal === 'bot-templates')
  const shareRequest = useBotShareReceiveRequest()

  return (
    <>
      {newBotOpen ? (
        <NewBotDialog
          open={newBotOpen}
          onOpenChange={(open, made) => {
            onNewBotOpenChange(open)
            if (made) {
              onBotCreated(made)
            }
          }}
        />
      ) : null}
      {templatesOpen ? (
        <Suspense fallback={null}>
          <BotTemplatesDialog />
        </Suspense>
      ) : null}
      {shareRequest ? (
        <Suspense fallback={null}>
          <BotShareReceiveFlow key={shareRequest.key} request={shareRequest} />
        </Suspense>
      ) : null}
    </>
  )
}

export function SimpleBotsShell({ layout }: { layout: AppChromeLayout }): React.JSX.Element {
  const t = useTranslate()
  const bots = useBots()
  const activeView = useAppStore((s) => s.activeView)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const toggleRightSidebar = useAppStore((s) => s.toggleRightSidebar)
  const closeMobilePage = useAppStore((s) => s.closeMobilePage)

  const [newBotOpen, setNewBotOpen] = useState(false)
  const [rightTab, setRightTab] = useState<SimpleBotsRightTab>('home')
  const [creatingChat, setCreatingChat] = useState(false)

  const activeBot = useMemo(() => {
    if (activeWorktreeId) {
      const matched = bots.find(
        (bot) => folderWorkspaceKey(bot.folderWorkspaceId) === activeWorktreeId
      )
      if (matched) {
        return matched
      }
    }
    return bots[0] ?? null
  }, [activeWorktreeId, bots])

  const activeBotWorkspaceId = activeBot ? folderWorkspaceKey(activeBot.folderWorkspaceId) : null
  const activeBotOffline = useBotHostOffline(activeBot?.hostId ?? 'local')
  const activeBotTree = useBotOwnChatTree(activeBot)

  // Open the active bot's Home Chat automatically when entering Simple mode from a non-bot workspace.
  const autoOpenedBotKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeBot || activeView !== 'terminal') {
      return
    }
    const botKey = `${activeBot.hostId}:${activeBot.id}`
    const workspaceId = folderWorkspaceKey(activeBot.folderWorkspaceId)
    const state = useAppStore.getState()
    const currentChat = selectFocusedChatTab(state, workspaceId)
    if (state.activeWorktreeId === workspaceId && currentChat) {
      autoOpenedBotKeyRef.current = botKey
      return
    }
    if (autoOpenedBotKeyRef.current === botKey) {
      return
    }
    autoOpenedBotKeyRef.current = botKey
    void openBotHomeTab(activeBot)
  }, [activeBot, activeView])

  const activeChatTab = useAppStore((state) => {
    const focused = selectFocusedChatTab(state, activeBotWorkspaceId)
    if (focused) {
      return focused
    }
    if (!activeBotWorkspaceId) {
      return null
    }
    const tabs = state.unifiedTabsByWorktree[activeBotWorkspaceId]
    return tabs?.find((tab) => isStructuredTab(tab)) ?? null
  })

  const chatOwner = useAppStore((state) =>
    activeChatTab ? structuredAgentSessionOwnerForTab(state, activeChatTab) : null
  )
  const chatTarget = useMemo(
    () =>
      structuredAgentSessionTargetForHost(chatOwner ?? activeBot?.hostId ?? null) ?? {
        kind: 'local' as const
      },
    [chatOwner, activeBot?.hostId]
  )

  const activeChatTitle = useMemo(() => {
    if (!activeChatTab || !activeBot) {
      return null
    }
    if (activeChatTab.entityId === activeBot.chatSessionId) {
      return t('simpleBots.chat.home', 'Home')
    }
    const matched = activeBotTree.chats.find(
      (chat) =>
        chat.chatId === activeChatTab.entityId || chat.liveSessionId === activeChatTab.entityId
    )
    const title = matched?.title.trim()
    return title || t('simpleBots.chat.fallbackTitle', 'Chat')
  }, [activeBot, activeBotTree.chats, activeChatTab, t])

  const handleNewChat = (): void => {
    if (!activeBot || creatingChat || activeBotOffline) {
      return
    }
    setCreatingChat(true)
    const workspaceId = folderWorkspaceKey(activeBot.folderWorkspaceId)
    void startBotSession(activeBot, { agent: activeBot.agent })
      .then((sessionId) =>
        activateAiVaultStructuredSession({
          structuredSession: { workspaceId, sessionId }
        })
      )
      .catch((error: unknown) => {
        toast.error(botErrorMessage(error))
      })
      .finally(() => {
        setCreatingChat(false)
      })
  }

  const handleSelectBot = (bot: Bot): void => {
    if (activeView === 'settings') {
      useAppStore.getState().closeSettingsPage()
    } else if (activeView === 'mobile') {
      closeMobilePage()
    }
    autoOpenedBotKeyRef.current = `${bot.hostId}:${bot.id}`
  }

  if (activeView === 'settings' || activeView === 'mobile') {
    const isMobile = activeView === 'mobile'
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div
          style={DRAG_STYLE}
          className="flex h-(--app-header-height) shrink-0 items-center justify-between border-b border-border pr-3"
        >
          <div className="flex items-center">
            {hasMacTrafficLights && !layout.isFullScreen ? (
              <div className="titlebar-traffic-light-pad" />
            ) : (
              <div className="pl-2" />
            )}
            {isMobile ? (
              <Button
                variant="ghost"
                size="xs"
                style={NO_DRAG_STYLE}
                onClick={closeMobilePage}
                className="ml-2"
              >
                <ArrowLeft className="size-3.5" />
                <span>{t('simpleBots.shell.backToBots', 'Back to bots')}</span>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={null}>{isMobile ? <MobilePage /> : <Settings />}</Suspense>
        </div>
        <SimpleBotsModals
          newBotOpen={newBotOpen}
          onNewBotOpenChange={setNewBotOpen}
          onBotCreated={(bot) => void openBotHomeTab(bot)}
        />
      </div>
    )
  }

  return (
    <RecoverableRenderErrorBoundary
      boundaryId="app.simple-bots-shell"
      surface="workspace-shell"
      resetKey={activeBot?.id ?? 'empty'}
      title={t('simpleBots.shell.errorTitle', 'The bots view hit an error.')}
      description={t(
        'simpleBots.shell.errorDescription',
        'Retry the view or switch back to Code mode.'
      )}
    >
      <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden bg-background">
        {layout.sidebarOpen ? (
          <SimpleBotsSidebar
            layout={layout}
            bots={bots}
            activeWorkspaceId={activeBotWorkspaceId}
            activeSessionId={activeChatTab?.entityId ?? null}
            onSelectBot={handleSelectBot}
            onNewBot={() => setNewBotOpen(true)}
          />
        ) : (
          <SimpleSidebarEdgeExpandHandle
            side="left"
            label={t('simpleBots.shell.expandSidebar', 'Expand bots sidebar')}
            onExpand={toggleSidebar}
          />
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <SimpleBotsHeader
            layout={layout}
            activeBot={activeBot}
            activeChatTitle={activeChatTitle}
            creatingChat={creatingChat}
            offline={activeBotOffline}
            rightSidebarOpen={layout.rightSidebarOpen}
            onToggleSidebar={toggleSidebar}
            onNewChat={handleNewChat}
            onToggleRightSidebar={toggleRightSidebar}
          />

          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {!activeBot ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-border bg-card">
                  <BotIcon className="size-6 text-muted-foreground" />
                </div>
                <h1 className="text-base font-semibold text-foreground">
                  {t('simpleBots.empty.title', 'Create your first bot')}
                </h1>
                <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">
                  {t(
                    'simpleBots.empty.description',
                    'Give a bot a job in plain English, schedule check-ins, and chat from desktop or your phone without touching terminals or Git.'
                  )}
                </p>
                <div className="mt-5 flex items-center gap-2">
                  <Button size="sm" onClick={() => setNewBotOpen(true)}>
                    <Plus className="size-4" />
                    <span>{t('simpleBots.sidebar.newBot', 'New bot')}</span>
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openBotTemplates()}>
                    <LayoutTemplate className="size-4" />
                    <span>{t('simpleBots.sidebar.browseTemplates', 'Browse templates')}</span>
                  </Button>
                </div>
              </div>
            ) : activeChatTab &&
              isStructuredTab(activeChatTab) &&
              activeChatTab.agentSessionAgent ? (
              <NativeChatPaneLifetime
                key={`${chatOwner ?? activeBot.hostId}:${activeChatTab.entityId}`}
                isVisible
              >
                <NativeChatHostOutageOwner target={chatTarget}>
                  <NativeChatComposerEditorOwner>
                    <ActivityPortalContainer visible>
                      <Activity mode="visible">
                        <NativeChatView
                          mode="structured"
                          tabId={activeChatTab.id}
                          groupId={activeChatTab.groupId}
                          sessionId={activeChatTab.entityId}
                          agent={activeChatTab.agentSessionAgent}
                          isVisible
                          isFocusedGroup
                          target={chatTarget}
                        />
                      </Activity>
                    </ActivityPortalContainer>
                  </NativeChatComposerEditorOwner>
                </NativeChatHostOutageOwner>
              </NativeChatPaneLifetime>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>
                  {t('simpleBots.shell.openingBot', 'Opening {{name}}…', { name: activeBot.name })}
                </span>
              </div>
            )}
          </main>
        </div>

        {layout.rightSidebarOpen && activeBot ? (
          <SimpleBotsRightPanel
            bot={activeBot}
            activeTab={rightTab}
            onTabChange={setRightTab}
            onClose={toggleRightSidebar}
          />
        ) : activeBot ? (
          <SimpleSidebarEdgeExpandHandle
            side="right"
            label={t('simpleBots.shell.expandRightPanel', 'Expand side panel')}
            onExpand={toggleRightSidebar}
          />
        ) : null}
      </div>

      <SimpleBotsModals
        newBotOpen={newBotOpen}
        onNewBotOpenChange={setNewBotOpen}
        onBotCreated={(bot) => {
          autoOpenedBotKeyRef.current = `${bot.hostId}:${bot.id}`
          void openBotHomeTab(bot)
        }}
      />
    </RecoverableRenderErrorBoundary>
  )
}
