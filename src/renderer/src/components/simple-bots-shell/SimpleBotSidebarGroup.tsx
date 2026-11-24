import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, MessageSquare, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { openBotHomeTab, startBotSession } from '@/lib/bot-catalog'
import { activateAiVaultStructuredSession } from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { useBotHostOffline } from '@/lib/bot-host-views'
import type { Bot } from '../../../../shared/bot-types'
import type { BotChatTreeChat } from '../../../../shared/bots/bot-chat-tree'
import { orderChatsTab } from '../../../../shared/bots/bot-chat-tree-view'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import { BotAvatar } from '../bots/BotAvatar'
import { botErrorMessage } from '../bots/bot-presentation'
import { openBotSession } from '../bots/bot-session-open'
import { useBotOwnChatTree } from '../bots/use-bot-chat-tree'

const INITIAL_CHATS_SHOWN = 6

function chatDisplayTitle(chat: BotChatTreeChat, t: Translate): string {
  if (chat.origin === 'home') {
    return t('simpleBots.chat.home', 'Home')
  }
  const title = chat.title.trim()
  if (title) {
    return title
  }
  const preview = chat.preview?.trim()
  if (preview) {
    return preview
  }
  return t('simpleBots.chat.untitled', 'New chat')
}

export function SimpleBotSidebarGroup({
  bot,
  activeWorkspaceId,
  activeSessionId,
  searchQuery,
  onSelectChat
}: {
  bot: Bot
  activeWorkspaceId: string | null
  activeSessionId: string | null
  searchQuery: string
  onSelectChat: (bot: Bot) => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const workspaceId = folderWorkspaceKey(bot.folderWorkspaceId)
  const isBotActive = activeWorkspaceId === workspaceId
  const offline = useBotHostOffline(bot.hostId)
  const tree = useBotOwnChatTree(bot)
  const [expanded, setExpanded] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [creatingChat, setCreatingChat] = useState(false)

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const orderedChats = useMemo(
    () => orderChatsTab(tree.chats).filter((chat) => !chat.closed && !chat.run),
    [tree.chats]
  )

  const filteredChats = useMemo(() => {
    if (!normalizedQuery) {
      return orderedChats
    }
    if (bot.name.toLowerCase().includes(normalizedQuery)) {
      return orderedChats
    }
    return orderedChats.filter((chat) => {
      const title = chatDisplayTitle(chat, t).toLowerCase()
      const preview = (chat.preview ?? '').toLowerCase()
      return title.includes(normalizedQuery) || preview.includes(normalizedQuery)
    })
  }, [bot.name, normalizedQuery, orderedChats, t])

  if (
    normalizedQuery &&
    !bot.name.toLowerCase().includes(normalizedQuery) &&
    filteredChats.length === 0
  ) {
    return null
  }

  const visibleChats =
    showAll || normalizedQuery ? filteredChats : filteredChats.slice(0, INITIAL_CHATS_SHOWN)
  const hiddenCount = filteredChats.length - visibleChats.length

  const hasWaiting = orderedChats.some((chat) => chat.live === 'needs-you')
  const hasReplying = orderedChats.some((chat) => chat.live === 'replying')

  const handleOpenBot = (): void => {
    onSelectChat(bot)
    void openBotHomeTab(bot)
  }

  const handleOpenChat = (chat: BotChatTreeChat): void => {
    onSelectChat(bot)
    if (chat.origin === 'home') {
      void openBotHomeTab(bot)
      return
    }
    openBotSession(bot, chat.chatId)
  }

  const handleNewChat = (event: React.MouseEvent): void => {
    event.stopPropagation()
    if (creatingChat || offline) {
      return
    }
    setCreatingChat(true)
    setExpanded(true)
    onSelectChat(bot)
    void startBotSession(bot, { agent: bot.agent })
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

  const newChatWithLabel = t('simpleBots.sidebar.newChatWith', 'New chat with {{name}}', {
    name: bot.name
  })

  return (
    <div className="mb-1.5">
      <div
        className={cn(
          'group flex h-8 items-center gap-1 rounded-md px-1.5 text-[13px] transition-colors',
          isBotActive && !activeSessionId
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/70'
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-label={
            expanded
              ? t('simpleBots.sidebar.collapseBot', 'Collapse {{name}}', { name: bot.name })
              : t('simpleBots.sidebar.expandBot', 'Expand {{name}}', { name: bot.name })
          }
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        <button
          type="button"
          onClick={handleOpenBot}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
        >
          <BotAvatar bot={bot} className="size-5 rounded-md" />
          <span className="truncate font-medium">{bot.name}</span>
          {hasWaiting ? (
            <span
              className="size-1.5 shrink-0 rounded-full bg-primary"
              title={t('simpleBots.sidebar.waitingForReply', 'Waiting for your reply')}
            />
          ) : hasReplying ? (
            <span
              className="size-1.5 shrink-0 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
              title={t('simpleBots.sidebar.working', 'Working')}
            />
          ) : null}
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={creatingChat || offline}
              onClick={handleNewChat}
              aria-label={newChatWithLabel}
              className="shrink-0"
            >
              <Plus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {newChatWithLabel}
          </TooltipContent>
        </Tooltip>
      </div>

      {expanded ? (
        <div className="mt-0.5 space-y-0.5 pl-4">
          {visibleChats.map((chat) => {
            const isCurrent =
              isBotActive &&
              (activeSessionId === chat.chatId ||
                (chat.liveSessionId !== undefined && activeSessionId === chat.liveSessionId))
            const label = chatDisplayTitle(chat, t)
            const timeAgo = chat.lastActiveAt ? formatShortTimeAgo(chat.lastActiveAt) : null
            return (
              <button
                key={chat.chatId}
                type="button"
                data-current={isCurrent ? 'true' : undefined}
                onClick={() => handleOpenChat(chat)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  isCurrent
                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                )}
              >
                <MessageSquare className="size-3.5 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {chat.live === 'needs-you' ? (
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                ) : chat.unread ? (
                  <span className="size-1.5 shrink-0 rounded-full bg-foreground/60" />
                ) : timeAgo ? (
                  <span className="shrink-0 text-2xs text-muted-foreground/80">{timeAgo}</span>
                ) : null}
              </button>
            )
          })}

          {orderedChats.length === 0 && tree.state === 'ready' ? (
            <button
              type="button"
              onClick={handleOpenBot}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
            >
              <MessageSquare className="size-3.5 shrink-0 opacity-60" />
              <span className="truncate">
                {t('simpleBots.sidebar.startChatting', 'Start chatting with {{name}}', {
                  name: bot.name
                })}
              </span>
            </button>
          ) : null}

          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full rounded-md px-2 py-1 text-left text-2xs text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
            >
              {t('simpleBots.sidebar.showMore', 'Show {{count}} more', { count: hiddenCount })}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
