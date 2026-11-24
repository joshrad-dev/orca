import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store/index'
import { getRendererAppPlatform } from '@/app-shell/platform/renderer-app-platform'
import { relearnHostStructuredAgents } from '@/runtime/native-chat/agent-catalogs/host-structured-agents'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host/execution-host'
import { resolveHostAgentStartupShell } from '../../../../shared/shell/launch/windows-terminal-shell'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { BotAgent } from '../../../../shared/bot-types'
import {
  getClaudeAccountErrorDescription,
  getCodexAccountErrorDescription,
  isClaudeAccountCancellation,
  isCodexAccountCancellation
} from '@/lib/provider-accounts/provider-account-action-errors'
import { useAntigravityChatSignIn } from '@/components/provider-accounts/use-antigravity-chat-sign-in'
import {
  cancelAntigravityChatSignIn,
  startAntigravityChatSignIn
} from '@/runtime/provider-accounts/sign-in/antigravity-chat-sign-in-status'
import {
  extractClaudeConnection,
  extractCodexConnection,
  findOnboardingAiProvider,
  mergeObservedProviderPlans,
  readInitialProviderConnections,
  resolveProviderCliInstallCommand,
  resolveProviderCliSignIn,
  type ProviderConnectionInfo
} from './ai-provider-catalog'

export type { ProviderConnectionInfo }

const LOCAL_OWNER: RuntimeClientTarget = { kind: 'local' }

export type ProviderSignInRequest = {
  agent: BotAgent
  /** True when Antigravity runs on Orca's managed ACP server rather than the `agy` CLI. */
  useAntigravityServer?: boolean
}

export type ActiveTerminalModal = {
  kind: 'sign-in' | 'install'
  agent: BotAgent
  command: string
  slashCommand?: string
}

export function useOnboardingProviderAccounts(onDialogOpenChange?: (open: boolean) => void) {
  const settings = useAppStore((s) => s.settings)
  const fetchSettings = useAppStore((s) => s.fetchSettings)
  const fetchRateLimits = useAppStore((s) => s.fetchRateLimits)
  const refreshRateLimits = useAppStore((s) => s.refreshRateLimits)
  const refreshDetectedAgents = useAppStore((s) => s.refreshDetectedAgents)
  const codexPlanType = useAppStore((s) => s.rateLimits.codex?.planType ?? null)
  const claudePlanType = useAppStore((s) => s.rateLimits.claude?.planType ?? null)
  const antigravitySignIn = useAntigravityChatSignIn(LOCAL_OWNER)

  const [connections, setConnections] = useState<Partial<Record<BotAgent, ProviderConnectionInfo>>>(
    {}
  )
  const [signInErrors, setSignInErrors] = useState<Partial<Record<BotAgent, string>>>({})
  const [signInQueue, setSignInQueue] = useState<ProviderSignInRequest[]>([])
  const [activeSignIn, setActiveSignIn] = useState<ProviderSignInRequest | null>(null)
  const [terminalModal, setTerminalModal] = useState<ActiveTerminalModal | null>(null)
  const mountedRef = useRef(true)

  const platform = getRendererAppPlatform()
  const startupShell =
    resolveHostAgentStartupShell({
      platform,
      isRemote: false,
      hostTerminalWindowsShell: settings?.terminalWindowsShell
    }) ?? (platform === 'win32' ? null : 'posix')

  useEffect(() => {
    mountedRef.current = true
    void relearnHostStructuredAgents(LOCAL_EXECUTION_HOST_ID, null, undefined)
    void fetchRateLimits()
    void readInitialProviderConnections().then((initial) => {
      if (mountedRef.current) {
        setConnections((prev) => ({ ...initial, ...prev }))
      }
    })
    return () => {
      mountedRef.current = false
    }
  }, [fetchRateLimits])

  useEffect(() => {
    onDialogOpenChange?.(terminalModal !== null)
    return () => {
      onDialogOpenChange?.(false)
    }
  }, [onDialogOpenChange, terminalModal])

  // Sync Orca-managed Antigravity server sign-in completion into connections & queue progression.
  useEffect(() => {
    if (antigravitySignIn.auth === 'signedIn') {
      setConnections((prev) =>
        prev.antigravity?.connected ? prev : { ...prev, antigravity: { connected: true } }
      )
    }
    if (activeSignIn?.agent !== 'antigravity' || !activeSignIn.useAntigravityServer) {
      return
    }
    const flow = antigravitySignIn.flow
    if (
      flow &&
      flow.phase !== 'starting' &&
      flow.phase !== 'waiting' &&
      flow.phase !== 'verifying'
    ) {
      if (flow.phase === 'failed' || flow.phase === 'expired') {
        const message = flow.error ?? antigravitySignIn.error ?? undefined
        if (message) {
          setSignInErrors((prev) => ({ ...prev, antigravity: message }))
        }
      }
      setActiveSignIn(null)
    }
  }, [activeSignIn, antigravitySignIn.auth, antigravitySignIn.error, antigravitySignIn.flow])

  const enqueueSignIn = useCallback((request: ProviderSignInRequest) => {
    setSignInErrors((prev) => {
      if (!prev[request.agent]) {
        return prev
      }
      const next = { ...prev }
      delete next[request.agent]
      return next
    })
    setSignInQueue((prev) =>
      prev.some((item) => item.agent === request.agent) ? prev : [...prev, request]
    )
  }, [])

  const removeFromQueue = useCallback((agent: BotAgent) => {
    setSignInQueue((prev) => prev.filter((item) => item.agent !== agent))
  }, [])

  const startProviderSignIn = useCallback(
    (request: ProviderSignInRequest) => {
      const provider = findOnboardingAiProvider(request.agent)
      setActiveSignIn(request)

      if (provider.signInKind === 'claude') {
        void window.api.claudeAccounts
          .add({ runtime: 'host', wslDistro: null, copyLink: false })
          .then((result) => {
            if (!mountedRef.current) {
              return
            }
            const nextClaude = extractClaudeConnection(result) ?? { connected: true }
            setConnections((prev) => ({ ...prev, claude: nextClaude }))
            void fetchSettings()
            void refreshRateLimits()
          })
          .catch((error: unknown) => {
            if (!mountedRef.current || isClaudeAccountCancellation(error)) {
              return
            }
            setSignInErrors((prev) => ({
              ...prev,
              claude: getClaudeAccountErrorDescription(error)
            }))
          })
          .finally(() => {
            if (mountedRef.current) {
              setActiveSignIn((curr) => (curr?.agent === 'claude' ? null : curr))
            }
          })
        return
      }

      if (provider.signInKind === 'codex') {
        void window.api.codexAccounts
          .add({ runtime: 'host', wslDistro: null })
          .then((result) => {
            if (!mountedRef.current) {
              return
            }
            const nextCodex = extractCodexConnection(result) ?? { connected: true }
            setConnections((prev) => ({ ...prev, codex: nextCodex }))
            void fetchSettings()
            void refreshRateLimits()
          })
          .catch((error: unknown) => {
            if (!mountedRef.current || isCodexAccountCancellation(error)) {
              return
            }
            setSignInErrors((prev) => ({
              ...prev,
              codex: getCodexAccountErrorDescription(error)
            }))
          })
          .finally(() => {
            if (mountedRef.current) {
              setActiveSignIn((curr) => (curr?.agent === 'codex' ? null : curr))
            }
          })
        return
      }

      if (provider.signInKind === 'antigravity' && request.useAntigravityServer) {
        void startAntigravityChatSignIn(LOCAL_OWNER, 'signIn').catch((error: unknown) => {
          if (!mountedRef.current) {
            return
          }
          setSignInErrors((prev) => ({
            ...prev,
            antigravity: error instanceof Error ? error.message : String(error)
          }))
          setActiveSignIn((curr) => (curr?.agent === 'antigravity' ? null : curr))
        })
        return
      }

      const cliSignIn = resolveProviderCliSignIn(request.agent, startupShell)
      if (!cliSignIn) {
        setActiveSignIn(null)
        return
      }
      setTerminalModal({
        kind: 'sign-in',
        agent: request.agent,
        command: cliSignIn.command,
        slashCommand: cliSignIn.slashCommand
      })
    },
    [fetchSettings, refreshRateLimits, startupShell]
  )

  // Dequeue the next provider automatically once the current sign-in finishes.
  useEffect(() => {
    if (activeSignIn !== null || terminalModal !== null || signInQueue.length === 0) {
      return
    }
    const [nextRequest, ...rest] = signInQueue
    setSignInQueue(rest)
    startProviderSignIn(nextRequest)
  }, [activeSignIn, signInQueue, startProviderSignIn, terminalModal])

  const cancelActiveSignIn = useCallback(
    (agent: BotAgent) => {
      if (agent === 'claude') {
        void window.api.claudeAccounts.cancelPendingLogin()
      } else if (agent === 'codex') {
        void window.api.codexAccounts.cancelPendingLogin()
      } else if (agent === 'antigravity' && activeSignIn?.useAntigravityServer) {
        void cancelAntigravityChatSignIn(LOCAL_OWNER)
      }
      if (terminalModal?.agent === agent) {
        setTerminalModal(null)
      }
      setActiveSignIn((curr) => (curr?.agent === agent ? null : curr))
    },
    [activeSignIn?.useAntigravityServer, terminalModal?.agent]
  )

  const openShellInstallModal = useCallback(
    (agent: BotAgent) => {
      const command = resolveProviderCliInstallCommand(agent, platform)
      if (!command) {
        return
      }
      setTerminalModal({ kind: 'install', agent, command })
    },
    [platform]
  )

  const completeTerminalModal = useCallback(
    (markConnected: boolean) => {
      const current = terminalModal
      setTerminalModal(null)
      if (!current) {
        return
      }
      if (current.kind === 'install') {
        void refreshDetectedAgents(undefined, { wakeWslDistro: true, userInitiated: true })
        if (markConnected) {
          enqueueSignIn({ agent: current.agent })
        }
        return
      }
      if (markConnected) {
        setConnections((prev) => ({
          ...prev,
          [current.agent]: prev[current.agent]?.connected
            ? prev[current.agent]
            : { connected: true }
        }))
        void refreshDetectedAgents(undefined, { wakeWslDistro: true })
      }
      setActiveSignIn((curr) => (curr?.agent === current.agent ? null : curr))
    },
    [enqueueSignIn, refreshDetectedAgents, terminalModal]
  )

  const resolvedConnections = useMemo(
    () => mergeObservedProviderPlans(connections, codexPlanType, claudePlanType),
    [claudePlanType, codexPlanType, connections]
  )

  return {
    connections: resolvedConnections,
    signInErrors,
    signInQueue,
    activeSignIn,
    terminalModal,
    platform,
    enqueueSignIn,
    removeFromQueue,
    cancelActiveSignIn,
    openShellInstallModal,
    completeTerminalModal
  }
}
