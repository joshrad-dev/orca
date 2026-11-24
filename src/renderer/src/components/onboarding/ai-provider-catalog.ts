import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { TUI_AGENT_DISPLAY_NAMES } from '../../../../shared/agent-launch/catalog/tui-agent-display-names'
import {
  agentSessionInstallCommand,
  agentSessionSetupFor,
  agentSessionSignInCommand
} from '../../../../shared/agent-session/lifecycle/launch/agent-session-setup-commands'
import type { BotAgent } from '../../../../shared/bot-types'
import type { AgentStartupShell } from '../../../../shared/agent-launch/startup/tui-agent-startup-shell'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type {
  ClaudeRateLimitAccountsState,
  CodexRateLimitAccountsState
} from '../../../../shared/agent-accounts/managed-account-types'
import { codexPlanLabelFromWorkspaceLabel } from '../../../../shared/agent-accounts/codex/codex-plan-workspace-label'
import { formatPlanLabel } from '@/components/status-bar/usage/usage-roster-formatting'
import { callAntigravityAccounts } from '@/runtime/provider-accounts/sign-in/runtime-antigravity-accounts-client'

export type ProviderConnectionInfo = {
  connected: boolean
  accountLabel?: string | null
  planLabel?: string | null
}

const LOCAL_OWNER: RuntimeClientTarget = { kind: 'local' }

export function extractClaudeConnection(
  state: ClaudeRateLimitAccountsState
): ProviderConnectionInfo | null {
  const activeAccount = state.activeAccountId
    ? state.accounts.find((account) => account.id === state.activeAccountId)
    : undefined
  const email = activeAccount?.email ?? state.systemDefaultEmail ?? state.accounts[0]?.email ?? null
  if (state.accounts.length === 0 && !email) {
    return null
  }
  return { connected: true, accountLabel: email }
}

export function extractCodexConnection(
  state: CodexRateLimitAccountsState
): ProviderConnectionInfo | null {
  const activeAccount = state.activeAccountId
    ? state.accounts.find((account) => account.id === state.activeAccountId)
    : undefined
  const preferredAccount =
    activeAccount ?? (state.systemDefault?.hasAuth ? undefined : state.accounts[0])
  const email =
    preferredAccount?.email ?? state.systemDefault?.email ?? state.accounts[0]?.email ?? null
  const workspaceLabel =
    preferredAccount?.workspaceLabel ??
    state.systemDefault?.workspaceLabel ??
    state.accounts[0]?.workspaceLabel ??
    null
  if (state.accounts.length === 0 && state.systemDefault?.hasAuth !== true && !email) {
    return null
  }
  return {
    connected: true,
    accountLabel: email,
    planLabel: codexPlanLabelFromWorkspaceLabel(workspaceLabel)
  }
}

export function mergeObservedProviderPlans(
  connections: Partial<Record<BotAgent, ProviderConnectionInfo>>,
  codexPlanType: string | null,
  claudePlanType: string | null
): Partial<Record<BotAgent, ProviderConnectionInfo>> {
  const liveCodexPlan = formatPlanLabel(codexPlanType, 'codex')
  const liveClaudePlan = formatPlanLabel(claudePlanType, 'claude')
  const codexConn = connections.codex?.connected && liveCodexPlan ? connections.codex : null
  const claudeConn = connections.claude?.connected && liveClaudePlan ? connections.claude : null
  if (!codexConn && !claudeConn) {
    return connections
  }
  return {
    ...connections,
    ...(codexConn ? { codex: { ...codexConn, planLabel: liveCodexPlan } } : null),
    ...(claudeConn ? { claude: { ...claudeConn, planLabel: liveClaudePlan } } : null)
  }
}

export async function readInitialProviderConnections(): Promise<
  Partial<Record<BotAgent, ProviderConnectionInfo>>
> {
  const next: Partial<Record<BotAgent, ProviderConnectionInfo>> = {}
  const [claude, codex, antigravity, cursor, grok] = await Promise.allSettled([
    window.api.claudeAccounts.list(),
    window.api.codexAccounts.list(),
    callAntigravityAccounts(LOCAL_OWNER, { runtime: 'host', wslDistro: null }, 'List'),
    window.api.cursorAccounts.getStatus(),
    window.api.grokAccounts.getStatus()
  ])
  if (claude.status === 'fulfilled') {
    const connection = extractClaudeConnection(claude.value)
    if (connection) {
      next.claude = connection
    }
  }
  if (codex.status === 'fulfilled') {
    const connection = extractCodexConnection(codex.value)
    if (connection) {
      next.codex = connection
    }
  }
  if (antigravity.status === 'fulfilled') {
    const email =
      antigravity.value.currentAccount?.email ?? antigravity.value.accounts[0]?.email ?? null
    if (antigravity.value.chatAgySignedOut === false || Boolean(email)) {
      next.antigravity = { connected: true, accountLabel: email }
    }
  }
  if (cursor.status === 'fulfilled' && cursor.value.signedIn) {
    next.cursor = { connected: true, accountLabel: cursor.value.email }
  }
  if (grok.status === 'fulfilled' && grok.value.signedIn) {
    next.grok = { connected: true, accountLabel: grok.value.email }
  }
  return next
}

export type OnboardingAiProvider = {
  agent: BotAgent
  /** True when Orca ships a built-in one-click managed CLI installer for this provider. */
  managedInstall: boolean
  /** Sign-in mechanism: browser OAuth via Orca accounts IPC, or CLI command in an inline terminal. */
  signInKind: 'claude' | 'codex' | 'antigravity' | 'cli'
  getLabel: (t: Translate) => string
  getSubtitle: (t: Translate) => string
}

export const FEATURED_AI_PROVIDERS: readonly OnboardingAiProvider[] = [
  {
    agent: 'claude',
    managedInstall: true,
    signInKind: 'claude',
    getLabel: (t) => t('components.onboarding.aiProviders.featured.claude.label', 'Claude'),
    getSubtitle: (t) =>
      t(
        'components.onboarding.aiProviders.featured.claude.subtitle',
        'Anthropic · Claude Pro, Max, or API'
      )
  },
  {
    agent: 'codex',
    managedInstall: true,
    signInKind: 'codex',
    getLabel: (t) => t('components.onboarding.aiProviders.featured.chatgpt.label', 'ChatGPT'),
    getSubtitle: (t) =>
      t(
        'components.onboarding.aiProviders.featured.chatgpt.subtitle',
        'OpenAI · ChatGPT Plus, Pro, or API'
      )
  },
  {
    agent: 'antigravity',
    managedInstall: true,
    signInKind: 'antigravity',
    getLabel: (t) =>
      t('components.onboarding.aiProviders.featured.antigravity.label', 'Google (Antigravity)'),
    getSubtitle: (t) =>
      t(
        'components.onboarding.aiProviders.featured.antigravity.subtitle',
        'Google · Gemini & Antigravity account'
      )
  },
  {
    agent: 'opencode2',
    managedInstall: true,
    signInKind: 'cli',
    getLabel: (t) => t('components.onboarding.aiProviders.featured.opencode2.label', 'OpenCode 2'),
    getSubtitle: (t) =>
      t(
        'components.onboarding.aiProviders.featured.opencode2.subtitle',
        'OpenCode 2 · Multi-model providers & API keys'
      )
  }
]

const MANAGED_OTHER_AGENTS: readonly BotAgent[] = [
  'opencode',
  'copilot',
  'cursor',
  'grok',
  'kimi',
  'omp'
]

const SHELL_OTHER_AGENTS: readonly BotAgent[] = [
  'gemini',
  'pi',
  'hermes',
  'kiro',
  'goose',
  'kilo',
  'droid',
  'cline',
  'devin',
  'qwen-code',
  'aug',
  'mimo-code',
  'codebuddy'
]

function buildOtherProvider(agent: BotAgent, managedInstall: boolean): OnboardingAiProvider {
  const displayName = TUI_AGENT_DISPLAY_NAMES[agent]
  return {
    agent,
    managedInstall,
    signInKind: 'cli',
    getLabel: () => displayName,
    getSubtitle: (t) =>
      managedInstall
        ? t(
            'components.onboarding.aiProviders.other.oneClickInstall',
            'One-click install & sign in'
          )
        : t(
            'components.onboarding.aiProviders.other.cliSetup',
            'Install & sign in via setup terminal'
          )
  }
}

export const PRIMARY_OTHER_AI_PROVIDERS: readonly OnboardingAiProvider[] = MANAGED_OTHER_AGENTS.map(
  (agent) => buildOtherProvider(agent, true)
)

export const MORE_OTHER_AI_PROVIDERS: readonly OnboardingAiProvider[] = SHELL_OTHER_AGENTS.map(
  (agent) => buildOtherProvider(agent, false)
)

export const ALL_ONBOARDING_AI_PROVIDERS: readonly OnboardingAiProvider[] = [
  ...FEATURED_AI_PROVIDERS,
  ...PRIMARY_OTHER_AI_PROVIDERS,
  ...MORE_OTHER_AI_PROVIDERS
]

export function findOnboardingAiProvider(agent: BotAgent): OnboardingAiProvider {
  return (
    ALL_ONBOARDING_AI_PROVIDERS.find((entry) => entry.agent === agent) ??
    buildOtherProvider(agent, false)
  )
}

export function getOnboardingProviderLabel(agent: BotAgent, t: Translate = translate): string {
  return findOnboardingAiProvider(agent).getLabel(t)
}

export function resolveProviderCliSignIn(
  agent: BotAgent,
  shell: AgentStartupShell | null
): { command: string; slashCommand?: string } | null {
  const command = agentSessionSignInCommand(agent, {
    account: agent === 'antigravity' ? 'system' : undefined,
    remote: false,
    shell
  })
  if (!command) {
    return null
  }
  const setup = agentSessionSetupFor(agent)
  const slashCommand = setup && 'slashCommand' in setup ? setup.slashCommand : undefined
  return { command, slashCommand }
}

export function resolveProviderCliInstallCommand(
  agent: BotAgent,
  platform: string | null | undefined
): string | null {
  return agentSessionInstallCommand(agent, platform)
}
