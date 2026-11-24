import { useCallback, useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type { Bot } from '../../../../shared/bot-types'
import type { DirEntry } from '../../../../shared/file-listing/directory-entry'
import { botHomePath, readBotHomeDir, type BotHome } from '../settings/bots/bot-home-files'
import { useBotHome } from '../settings/bots/use-bot-home-file'

// Internal bot configuration and runtime folders stay out of the non-technical output files list.
const INTERNAL_BOT_ENTRIES: ReadonlySet<string> = new Set([
  'SOUL.md',
  'MEMORY.md',
  'AGENTS.md',
  'CLAUDE.md',
  'memory',
  'skills',
  'node_modules'
])

function isVisibleOutputEntry(entry: DirEntry): boolean {
  if (entry.name.startsWith('.')) {
    return false
  }
  return !INTERNAL_BOT_ENTRIES.has(entry.name)
}

const FILE_NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base' })

function sortEntries(entries: readonly DirEntry[]): DirEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }
    return FILE_NAME_COLLATOR.compare(a.name, b.name)
  })
}

function OutputFileIcon({ name }: { name: string }): React.JSX.Element {
  const lower = name.toLowerCase()
  if (/\.(png|jpe?g|gif|webp|svg|heic)$/.test(lower)) {
    return <FileImage className="size-4 shrink-0 text-muted-foreground" />
  }
  if (/\.(csv|tsv|xlsx?|numbers)$/.test(lower)) {
    return <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
  }
  if (/\.(pdf|md|txt|docx?|rtf|pages|html?)$/.test(lower)) {
    return <FileText className="size-4 shrink-0 text-muted-foreground" />
  }
  return <File className="size-4 shrink-0 text-muted-foreground" />
}

function openHostPath(home: BotHome, relativePath: string): void {
  const fullPath = relativePath === '.' ? home.folderPath : botHomePath(home, relativePath)
  void window.api.shell.openPath(fullPath, home.bot.hostId).catch((error: unknown) => {
    toast.error(
      error instanceof Error
        ? error.message
        : translate('simpleBots.files.openFailed', 'Could not open file.')
    )
  })
}

function FolderChildren({
  home,
  relativePath,
  refreshToken
}: {
  home: BotHome
  relativePath: string
  refreshToken: number
}): React.JSX.Element {
  const t = useTranslate()
  const [entries, setEntries] = useState<DirEntry[] | null>(null)

  useEffect(() => {
    let active = true
    void readBotHomeDir(home, relativePath)
      .then((list) => {
        if (active) {
          setEntries(sortEntries(list.filter((entry) => !entry.name.startsWith('.'))))
        }
      })
      .catch(() => {
        if (active) {
          setEntries([])
        }
      })
    return () => {
      active = false
    }
  }, [home, relativePath, refreshToken])

  if (entries === null) {
    return (
      <p className="px-3 py-1 text-2xs text-muted-foreground">
        {t('simpleBots.files.loading', 'Loading…')}
      </p>
    )
  }
  if (entries.length === 0) {
    return (
      <p className="px-3 py-1 text-2xs text-muted-foreground">
        {t('simpleBots.files.emptyFolder', 'Empty folder')}
      </p>
    )
  }

  return (
    <div className="space-y-0.5 pl-4">
      {entries.map((entry) => (
        <OutputEntryRow
          key={entry.name}
          home={home}
          entry={entry}
          relativePath={`${relativePath}/${entry.name}`}
          refreshToken={refreshToken}
        />
      ))}
    </div>
  )
}

function OutputEntryRow({
  home,
  entry,
  relativePath,
  refreshToken
}: {
  home: BotHome
  entry: DirEntry
  relativePath: string
  refreshToken: number
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  if (entry.isDirectory) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {expanded ? (
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate">{entry.name}</span>
        </button>
        {expanded ? (
          <FolderChildren home={home} relativePath={relativePath} refreshToken={refreshToken} />
        ) : null}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => openHostPath(home, relativePath)}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <OutputFileIcon name={entry.name} />
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
    </button>
  )
}

export function SimpleChatFilesPanel({
  bot,
  onClose
}: {
  bot: Bot
  onClose?: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const home = useBotHome(bot)
  const [entries, setEntries] = useState<DirEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const loadFiles = useCallback(async () => {
    if (!home) {
      setEntries(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await readBotHomeDir(home, '.')
      setEntries(sortEntries(list.filter(isVisibleOutputEntry)))
    } catch (readError: unknown) {
      setError(
        readError instanceof Error
          ? readError.message
          : translate('simpleBots.files.readFailed', 'Could not read files.')
      )
    } finally {
      setLoading(false)
    }
  }, [home])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles, refreshToken])

  const handleRefresh = (): void => {
    setRefreshToken((token) => token + 1)
  }

  const openFolderLabel = t('simpleBots.files.openFolder', 'Open folder')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2.5 pb-1">
        <span className="truncate text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('simpleBots.files.heading', 'Output files')}
        </span>
        <div className="flex items-center gap-0.5">
          {home ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={openFolderLabel}
                  onClick={() => openHostPath(home, '.')}
                >
                  <FolderOpen className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {openFolderLabel}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t('simpleBots.files.refreshAria', 'Refresh files')}
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              {t('simpleBots.files.refresh', 'Refresh')}
            </TooltipContent>
          </Tooltip>
          {onClose ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t('simpleBots.files.closeAria', 'Close files')}
              onClick={onClose}
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        {!home ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            {t('simpleBots.files.loadingForBot', 'Loading {{name}}’s files…', { name: bot.name })}
          </p>
        ) : error ? (
          <div className="space-y-2 px-2 py-4 text-xs text-muted-foreground">
            <p>{error}</p>
            <Button variant="outline" size="xs" onClick={handleRefresh}>
              {t('bots.chats.searchRetry', 'Try again')}
            </Button>
          </div>
        ) : entries === null ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            {t('simpleBots.files.loading', 'Loading…')}
          </p>
        ) : entries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
            <Folder className="mb-2.5 size-7 text-muted-foreground/50" />
            <p className="text-[13px] font-medium text-foreground">
              {t('simpleBots.files.emptyTitle', 'No files yet')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                'simpleBots.files.emptyBody',
                'Documents, spreadsheets, images, and other files {{name}} creates will show up here.',
                { name: bot.name }
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {entries.map((entry) => (
              <OutputEntryRow
                key={entry.name}
                home={home}
                entry={entry}
                relativePath={entry.name}
                refreshToken={refreshToken}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
