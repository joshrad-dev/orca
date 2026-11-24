import { translate } from '@/i18n/i18n'
import { formatPlanLabel } from '@/components/status-bar/usage/usage-roster-formatting'
import { callAntigravityAccounts } from '@/runtime/provider-accounts/sign-in/runtime-antigravity-accounts-client'
import {
  getClaudeAccountErrorDescription,
  getCodexAccountErrorDescription,
  isClaudeAccountCancellation,
  isCodexAccountCancellation
} from '@/lib/provider-accounts/provider-account-action-errors'
import type { BotAgent } from '../../../../shared/bot-types'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type {
  ClaudeRateLimitAccountsState,
  CodexRateLimitAccountsState
} from '../../../../shared/agent-accounts/managed-account-types'
import { codexPlanLabelFromWorkspaceLabel } from '../../../../shared/agent-accounts/codex/codex-plan-workspace-label'
import { getOnboardingProviderLabel } from './ai-provider-catalog'

export type ProviderConnectionInfo = {
  connected: boolean
  accountLabel?: string | null
  planLabel?: string | null
}

export type TerminalModalOutcome = 'command-succeeded' | 'manual-done' | 'cancelled'

const LOCAL_OWNER: RuntimeClientTarget = { kind: 'local' }

const INSPECTABLE_CONNECTION_AGENTS: readonly BotAgent[] = [
  'claude',
  'codex',
  'antigravity',
  'cursor',
  'grok'
]

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

/**
 * Re-reads persisted account status for providers Orca can inspect.
 * Returns `null` when signed out, or `undefined` when Orca has no status API for `agent`.
 */
export async function readProviderConnection(
  agent: BotAgent
): Promise<ProviderConnectionInfo | null | undefined> {
  if (agent === 'claude') {
    const state = await window.api.claudeAccounts.list({ includeSystemDefault: true })
    return extractClaudeConnection(state)
  }
  if (agent === 'codex') {
    const state = await window.api.codexAccounts.list()
    return extractCodexConnection(state)
  }
  if (agent === 'antigravity') {
    const state = await callAntigravityAccounts(
      LOCAL_OWNER,
      { runtime: 'host', wslDistro: null },
      'List'
    )
    const email = state.currentAccount?.email ?? state.accounts[0]?.email ?? null
    return state.chatAgySignedOut === false || Boolean(email)
      ? { connected: true, accountLabel: email }
      : null
  }
  if (agent === 'cursor') {
    const status = await window.api.cursorAccounts.getStatus()
    return status.signedIn ? { connected: true, accountLabel: status.email } : null
  }
  if (agent === 'grok') {
    const status = await window.api.grokAccounts.getStatus()
    return status.signedIn ? { connected: true, accountLabel: status.email } : null
  }
  return undefined
}

export async function readInitialProviderConnections(): Promise<
  Partial<Record<BotAgent, ProviderConnectionInfo>>
> {
  const next: Partial<Record<BotAgent, ProviderConnectionInfo>> = {}
  const results = await Promise.allSettled(
    INSPECTABLE_CONNECTION_AGENTS.map(async (agent) => ({
      agent,
      connection: await readProviderConnection(agent)
    }))
  )
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.connection) {
      next[result.value.agent] = result.value.connection
    }
  }
  return next
}

export type OAuthSignInResult =
  | { kind: 'connected'; connection: ProviderConnectionInfo }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }

export async function runManagedOAuthSignIn(
  provider: 'claude' | 'codex'
): Promise<OAuthSignInResult> {
  try {
    if (provider === 'claude') {
      const result = await window.api.claudeAccounts.add({
        runtime: 'host',
        wslDistro: null,
        copyLink: false
      })
      return {
        kind: 'connected',
        connection: extractClaudeConnection(result) ?? { connected: true }
      }
    }
    const result = await window.api.codexAccounts.add({ runtime: 'host', wslDistro: null })
    return { kind: 'connected', connection: extractCodexConnection(result) ?? { connected: true } }
  } catch (error: unknown) {
    if (
      provider === 'claude' ? isClaudeAccountCancellation(error) : isCodexAccountCancellation(error)
    ) {
      return { kind: 'cancelled' }
    }
    return {
      kind: 'error',
      message:
        provider === 'claude'
          ? getClaudeAccountErrorDescription(error)
          : getCodexAccountErrorDescription(error)
    }
  }
}

export type TerminalSignInVerification =
  | { kind: 'connected'; connection: ProviderConnectionInfo; refreshRateLimits: boolean }
  | { kind: 'not-detected'; error: string }
  | { kind: 'unchanged' }

/** Verifies whether a terminal sign-in actually succeeded instead of trusting manual close. */
export async function verifyTerminalSignIn(
  agent: BotAgent,
  outcome: Exclude<TerminalModalOutcome, 'cancelled'>
): Promise<TerminalSignInVerification> {
  const verified = await readProviderConnection(agent).catch(() => null)
  if (verified !== undefined) {
    if (verified?.connected) {
      return {
        kind: 'connected',
        connection: verified,
        refreshRateLimits: agent === 'claude' || agent === 'codex'
      }
    }
    if (outcome === 'manual-done') {
      return {
        kind: 'not-detected',
        error: translate(
          'components.onboarding.aiProviders.errors.signInNotDetected',
          "Sign-in for {{provider}} wasn't detected yet. Try signing in again.",
          { provider: getOnboardingProviderLabel(agent) }
        )
      }
    }
    return { kind: 'unchanged' }
  }
  if (outcome === 'command-succeeded') {
    return { kind: 'connected', connection: { connected: true }, refreshRateLimits: false }
  }
  return { kind: 'unchanged' }
}
