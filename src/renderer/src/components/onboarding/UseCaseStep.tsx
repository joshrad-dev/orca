import {
  ArrowLeftRight,
  ArrowUp,
  Bot,
  Check,
  Code2,
  FileText,
  GitBranch,
  type LucideIcon
} from 'lucide-react'
import { Trans } from 'react-i18next'
import { cn } from '@/lib/class-names'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { i18n } from '@/i18n/i18n'
import { useTranslate } from '@/i18n/use-translate'
import { DiffLineCounts } from '@/components/right-sidebar/source-control/listing/diff-line-counts'
import type { OnboardingUseCase } from './use-onboarding-flow-types'

type UseCaseStepProps = {
  useCase: OnboardingUseCase
  onSelect: (useCase: OnboardingUseCase) => void
}

export function UseCaseStep({ useCase, onSelect }: UseCaseStepProps): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="space-y-6">
      <RadioGroup
        value={useCase}
        onValueChange={(value) => {
          if (value === 'everyday' || value === 'code') {
            onSelect(value)
          }
        }}
        layout="cards"
      >
        <UseCaseOption
          value="everyday"
          icon={Bot}
          label={t('components.onboarding.useCase.everyday.label', 'Everyday work')}
          description={t(
            'components.onboarding.useCase.everyday.description',
            'Keep bots front and center for everyday tasks, reminders, and files.'
          )}
          preview={<EverydayWorkPreview />}
          selected={useCase === 'everyday'}
        />
        <UseCaseOption
          value="code"
          icon={Code2}
          label={t('components.onboarding.useCase.code.label', 'Code')}
          description={t(
            'components.onboarding.useCase.code.description',
            'Work across repositories, branches, diffs, and coding agents in a full workspace.'
          )}
          preview={<CodeWorkspacePreview />}
          selected={useCase === 'code'}
        />
      </RadioGroup>
      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <ArrowLeftRight className="size-3.5 shrink-0" />
        <span>
          <Trans
            i18n={i18n}
            defaults={t(
              'components.onboarding.useCase.switchNote',
              'Switch between <em>Bots</em> and <em>Code</em> any time in <em>Settings → Agents</em>.'
            )}
            components={{
              em: <span className="font-medium text-foreground" />
            }}
          />
        </span>
      </p>
    </div>
  )
}

function UseCaseOption({
  value,
  icon: Icon,
  label,
  description,
  preview,
  selected
}: {
  value: OnboardingUseCase
  icon: LucideIcon
  label: string
  description: string
  preview: React.ReactNode
  selected: boolean
}): React.JSX.Element {
  return (
    <RadioGroupItem value={value} variant="media">
      <div
        aria-hidden
        className="h-52 border-b border-border bg-muted/40 p-5 transition-colors group-data-[state=checked]:bg-muted/70"
      >
        <div className="size-full overflow-hidden rounded-lg border border-border shadow-lg">
          {preview}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-5 pt-4 pb-5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="size-4 text-muted-foreground" />
          {label}
          <span
            className={cn(
              'ml-auto grid size-4 shrink-0 place-items-center rounded-full border transition-colors',
              selected ? 'border-foreground bg-foreground text-background' : 'border-input'
            )}
          >
            {selected ? <Check className="size-2.5" strokeWidth={3.5} /> : null}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </RadioGroupItem>
  )
}

function EverydayWorkPreview(): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="native-chat-appearance flex size-full bg-chat-canvas text-[10px] leading-[14px] text-chat-foreground">
      <div className="flex w-[112px] shrink-0 flex-col gap-1 border-r border-border bg-card/80 p-2">
        <div className="px-1.5 pb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('components.onboarding.useCase.preview.botsHeading', 'Bots')}
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-accent px-1.5 py-1 text-foreground">
          <Bot className="size-3 shrink-0" />
          <span className="truncate font-medium">
            {t('components.onboarding.useCase.preview.dailyBriefBot', 'Daily Brief')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground">
          <Bot className="size-3 shrink-0" />
          <span className="truncate">
            {t('components.onboarding.useCase.preview.researchBot', 'Research')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground">
          <Bot className="size-3 shrink-0" />
          <span className="truncate">
            {t('components.onboarding.useCase.preview.writingBot', 'Writing')}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 pt-2.5">
          <div className="ml-auto max-w-[85%] truncate rounded-[10px] border border-chat-user-border bg-chat-user-surface px-2.5 py-1 text-chat-foreground-strong">
            {t('components.onboarding.useCase.preview.userMessage', "Summarize today's notes")}
          </div>
          <p className="line-clamp-2 text-chat-foreground-strong">
            {t(
              'components.onboarding.useCase.preview.botMessage',
              'Here are the 3 action items from your meeting. Draft saved to Files.'
            )}
          </p>
          <div className="inline-flex w-fit items-center gap-1.5 rounded-md border border-chat-code-border bg-chat-code-surface px-2 py-1 text-[9.5px] text-chat-foreground-strong">
            <FileText className="size-3 shrink-0 text-chat-foreground-faint" />
            <span className="truncate">
              {t('components.onboarding.useCase.preview.outputFile', 'meeting-summary.md')}
            </span>
          </div>
        </div>
        <div className="shrink-0 px-2.5 pt-1.5 pb-2">
          <div className="flex items-center gap-2 rounded-[10px] border border-chat-composer-border bg-chat-composer-surface py-1 pr-1 pl-2.5 shadow-xs">
            <span className="truncate text-chat-foreground-faint">
              {t(
                'components.onboarding.useCase.preview.composerPlaceholder',
                'Message Daily Brief…'
              )}
            </span>
            <span className="ml-auto grid size-[16px] shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <ArrowUp className="size-2.5" strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Code and CLI output stay untranslated, matching the source and tools they represent.
const CODE_PREVIEW_REPO = 'orca'
const CODE_PREVIEW_BRANCHES = [
  { name: 'main', active: false },
  { name: 'feat/auth', active: true }
] as const
const CODE_PREVIEW_FILE = 'auth.ts'
const CODE_DIFF_LINES = [
  { id: 'removed', kind: 'del', line: '18', text: 'return verifyToken(header)' },
  { id: 'added', kind: 'add', line: '18', text: 'return verifyToken(header, { clockSkew: 5 })' }
] as const
const CODE_TERMINAL_COMMAND = 'claude'
const CODE_TERMINAL_RESULT = 'All 14 auth tests passed.'

function CodeWorkspacePreview(): React.JSX.Element {
  return (
    <div className="flex size-full bg-background text-[10px] leading-[14px] text-foreground">
      <div className="flex w-[108px] shrink-0 flex-col gap-1 border-r border-border bg-card/80 p-2">
        <div className="px-1.5 pb-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {CODE_PREVIEW_REPO}
        </div>
        {CODE_PREVIEW_BRANCHES.map((branch) => (
          <div
            key={branch.name}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-1.5 py-1',
              branch.active ? 'bg-accent text-foreground' : 'text-muted-foreground'
            )}
          >
            <GitBranch className="size-3 shrink-0" />
            <span className={cn('truncate font-mono', branch.active && 'font-medium')}>
              {branch.name}
            </span>
          </div>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5 font-mono text-[9.5px]">
          <span className="truncate font-medium text-foreground">{CODE_PREVIEW_FILE}</span>
          <DiffLineCounts added={1} removed={1} />
        </div>
        <div className="flex-1 overflow-hidden px-2 py-1.5 font-mono text-[9px] leading-[15px]">
          {CODE_DIFF_LINES.map((row) => (
            <div
              key={row.id}
              className={cn(
                'flex whitespace-nowrap rounded-sm',
                row.kind === 'add'
                  ? 'bg-[var(--diff-added-background)]'
                  : 'bg-[var(--diff-removed-background)]'
              )}
            >
              <span className="w-[3ch] shrink-0 pr-1 text-right text-muted-foreground">
                {row.line}
              </span>
              <span
                className={cn(
                  'w-3 shrink-0 text-center',
                  row.kind === 'add' ? 'text-status-success' : 'text-destructive'
                )}
              >
                {row.kind === 'add' ? '+' : '-'}
              </span>
              <span className="truncate pr-1.5">{row.text}</span>
            </div>
          ))}
        </div>
        <div className="dark border-t border-border bg-background px-2.5 py-1.5 font-mono text-[9px] leading-[14px] text-foreground/80">
          <div className="truncate">
            <span className="text-status-success">❯ </span>
            {CODE_TERMINAL_COMMAND}
          </div>
          <div className="truncate text-muted-foreground">
            <span className="text-status-success">● </span>
            {CODE_TERMINAL_RESULT}
          </div>
        </div>
      </div>
    </div>
  )
}
