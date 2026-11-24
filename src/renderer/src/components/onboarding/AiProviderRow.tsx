import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { Badge } from '@/components/ui/badge'
import { useManagedRuntimeInstall } from '@/runtime/hosts/installation/use-managed-runtime-install'
import {
  cancelManagedRuntimeInstall,
  installManagedRuntime
} from '@/runtime/hosts/installation/managed-runtime-install-status'
import { managedRuntimeInstallView } from '@/components/managed-runtime/managed-runtime-install-view'
import { antigravityProviderSignInShown } from '@/components/provider-accounts/antigravity-chat-runtime-sign-in-policy'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { BotAgent } from '../../../../shared/bot-types'
import type { OnboardingAiProvider } from './ai-provider-catalog'
import { resolveProviderCliInstallCommand } from './ai-provider-catalog'
import type {
  ProviderConnectionInfo,
  ProviderSignInRequest
} from './use-onboarding-provider-accounts'
import { AiProviderActionButton, AiProviderStatusLine } from './AiProviderStatusParts'

const LOCAL_OWNER: RuntimeClientTarget = { kind: 'local' }

export type AiProviderRowProps = {
  provider: OnboardingAiProvider
  variant: 'card' | 'row'
  detected: boolean
  platform: string | null | undefined
  connection: ProviderConnectionInfo | undefined
  signInError: string | undefined
  isSigningIn: boolean
  isQueued: boolean
  onEnqueueSignIn: (request: ProviderSignInRequest) => void
  onCancelSignIn: (agent: BotAgent) => void
  onRemoveFromQueue: (agent: BotAgent) => void
  onOpenShellInstall: (agent: BotAgent) => void
  onInstallingChange?: (agent: BotAgent, installing: boolean) => void
}

export function AiProviderRow({
  provider,
  variant,
  detected,
  platform,
  connection,
  signInError,
  isSigningIn,
  isQueued,
  onEnqueueSignIn,
  onCancelSignIn,
  onRemoveFromQueue,
  onOpenShellInstall,
  onInstallingChange
}: AiProviderRowProps): React.JSX.Element {
  const t = useTranslate()
  const label = provider.getLabel(t)
  const subtitle = provider.getSubtitle(t)
  const observation = useManagedRuntimeInstall(LOCAL_OWNER, provider.agent, provider.managedInstall)
  const [installPending, setInstallPending] = useState(false)
  const [cancelPending, setCancelPending] = useState(false)
  const [installRefusal, setInstallRefusal] = useState<string | null>(null)
  const autoSignInAfterInstallRef = useRef(false)

  const activeObservation = observation.kind === 'active' ? observation : null
  const knownState =
    activeObservation?.snapshot.kind === 'known' ? activeObservation.snapshot.state : null
  const view = activeObservation
    ? managedRuntimeInstallView(activeObservation.snapshot, label, cancelPending, t)
    : null

  const operationPhase = knownState?.operation?.phase
  const isInstalling =
    installPending ||
    operationPhase === 'downloading' ||
    operationPhase === 'extracting' ||
    operationPhase === 'verifying'
  const isInstalled =
    detected ||
    (knownState !== null && (knownState.source !== null || knownState.installedVersion !== null))
  const isConnected = connection?.connected === true
  const useAntigravityServer =
    provider.agent === 'antigravity' &&
    activeObservation !== null &&
    antigravityProviderSignInShown(activeObservation)

  useEffect(() => {
    onInstallingChange?.(provider.agent, isInstalling)
    return () => {
      onInstallingChange?.(provider.agent, false)
    }
  }, [isInstalling, onInstallingChange, provider.agent])

  // Once an install requested from this card settles, automatically queue sign-in.
  useEffect(() => {
    if (!autoSignInAfterInstallRef.current || isInstalling || !isInstalled) {
      return
    }
    autoSignInAfterInstallRef.current = false
    onEnqueueSignIn({ agent: provider.agent, useAntigravityServer })
  }, [isInstalled, isInstalling, onEnqueueSignIn, provider.agent, useAntigravityServer])

  const canManagedInstall =
    activeObservation !== null &&
    (knownState === null || knownState.available || knownState.damaged === true)
  const installChecking = provider.managedInstall && observation.kind === 'pending'
  const shellInstallCommand = resolveProviderCliInstallCommand(provider.agent, platform)

  const handleInstall = (): void => {
    setInstallRefusal(null)
    if (activeObservation && canManagedInstall) {
      setInstallPending(true)
      autoSignInAfterInstallRef.current = true
      void installManagedRuntime(activeObservation.subject)
        .catch((cause: unknown) => {
          autoSignInAfterInstallRef.current = false
          setInstallRefusal(
            cause instanceof Error
              ? cause.message
              : t('components.managed-runtime.failed', 'Installation failed. Try again.')
          )
        })
        .finally(() => setInstallPending(false))
      return
    }
    if (shellInstallCommand) {
      onOpenShellInstall(provider.agent)
    }
  }

  const handleCancelInstall = (): void => {
    const operationId = view?.action?.kind === 'cancel' ? view.action.operationId : null
    if (!activeObservation || !operationId) {
      return
    }
    autoSignInAfterInstallRef.current = false
    setCancelPending(true)
    void cancelManagedRuntimeInstall(activeObservation.subject, operationId).finally(() =>
      setCancelPending(false)
    )
  }

  const errorText = installRefusal ?? view?.error ?? signInError ?? null
  const downloadSizeMb =
    !isInstalled && knownState?.downloadBytes
      ? Math.ceil(knownState.downloadBytes / 1_000_000)
      : null

  const actionNode = (
    <AiProviderActionButton
      variant={variant}
      isConnected={isConnected}
      isSigningIn={isSigningIn}
      isQueued={isQueued}
      isInstalling={isInstalling}
      isInstalled={isInstalled}
      canInstall={canManagedInstall || Boolean(shellInstallCommand)}
      installChecking={installChecking}
      canCancelInstall={view?.action?.kind === 'cancel' && !cancelPending}
      onInstall={handleInstall}
      onCancelInstall={handleCancelInstall}
      onSignIn={() => onEnqueueSignIn({ agent: provider.agent, useAntigravityServer })}
      onCancelSignIn={() => onCancelSignIn(provider.agent)}
      onRemoveFromQueue={() => onRemoveFromQueue(provider.agent)}
    />
  )

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'flex flex-col justify-between gap-3 rounded-xl border bg-card p-4 transition-colors',
          isConnected
            ? 'border-foreground/30 bg-card'
            : isSigningIn || isInstalling
              ? 'border-foreground/25 bg-card'
              : 'border-border'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-muted/40">
              <AgentIcon agent={provider.agent} size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{label}</span>
                {isConnected ? (
                  <Badge variant="secondary">
                    <Check className="size-3 text-status-success" />
                    {t('components.onboarding.aiProviders.status.connected', 'Connected')}
                  </Badge>
                ) : null}
                {isConnected && connection?.planLabel ? (
                  <Badge variant="outline">{connection.planLabel}</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {isConnected && connection?.accountLabel ? connection.accountLabel : subtitle}
              </p>
            </div>
          </div>
          <div className="shrink-0">{actionNode}</div>
        </div>

        <AiProviderStatusLine
          isInstalling={isInstalling}
          isSigningIn={isSigningIn}
          isQueued={isQueued}
          isInstalled={isInstalled}
          isConnected={isConnected}
          progress={view?.progress ?? null}
          installStatus={view?.status ?? null}
          downloadSizeMb={downloadSizeMb}
          errorText={errorText}
          label={label}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-muted/40">
            <AgentIcon agent={provider.agent} size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{label}</span>
              {isConnected ? (
                <Badge variant="secondary">
                  <Check className="size-3 text-status-success" />
                  {t('components.onboarding.aiProviders.status.connected', 'Connected')}
                </Badge>
              ) : isInstalled && !isInstalling ? (
                <span className="text-2xs text-muted-foreground">
                  {t('components.onboarding.aiProviders.status.installed', 'Installed')}
                </span>
              ) : null}
              {isConnected && connection?.planLabel ? (
                <Badge variant="outline">{connection.planLabel}</Badge>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {isConnected && connection?.accountLabel ? connection.accountLabel : subtitle}
            </p>
          </div>
        </div>
        <div className="shrink-0">{actionNode}</div>
      </div>

      {isInstalling || isSigningIn || isQueued || errorText ? (
        <div className="pl-10">
          <AiProviderStatusLine
            isInstalling={isInstalling}
            isSigningIn={isSigningIn}
            isQueued={isQueued}
            isInstalled={isInstalled}
            isConnected={isConnected}
            progress={view?.progress ?? null}
            installStatus={view?.status ?? null}
            downloadSizeMb={null}
            errorText={errorText}
            label={label}
          />
        </div>
      ) : null}
    </div>
  )
}
