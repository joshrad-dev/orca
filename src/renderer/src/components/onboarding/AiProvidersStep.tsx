import { useCallback, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import type { BotAgent } from '../../../../shared/bot-types'
import { OnboardingInlineCommandTerminal } from './OnboardingInlineCommandTerminal'
import {
  FEATURED_AI_PROVIDERS,
  MORE_OTHER_AI_PROVIDERS,
  PRIMARY_OTHER_AI_PROVIDERS,
  getOnboardingProviderLabel
} from './ai-provider-catalog'
import { useOnboardingProviderAccounts } from './use-onboarding-provider-accounts'
import { AiProviderRow } from './AiProviderRow'

type AiProvidersStepProps = {
  detectedSet: Set<TuiAgent>
  onDialogOpenChange?: (open: boolean) => void
}

export function AiProvidersStep({
  detectedSet,
  onDialogOpenChange
}: AiProvidersStepProps): React.JSX.Element {
  const t = useTranslate()
  const accounts = useOnboardingProviderAccounts(onDialogOpenChange)
  const [showMoreOther, setShowMoreOther] = useState(false)
  const [installingAgents, setInstallingAgents] = useState<ReadonlySet<BotAgent>>(new Set())

  const handleInstallingChange = useCallback((agent: BotAgent, installing: boolean) => {
    setInstallingAgents((prev) => {
      const has = prev.has(agent)
      if (has === installing) {
        return prev
      }
      const next = new Set(prev)
      if (installing) {
        next.add(agent)
      } else {
        next.delete(agent)
      }
      return next
    })
  }, [])

  const connectedCount = Object.values(accounts.connections).filter(
    (entry) => entry?.connected
  ).length
  const installingCount = installingAgents.size
  const queuedCount = accounts.signInQueue.length
  const activeAgentLabel = accounts.activeSignIn
    ? getOnboardingProviderLabel(accounts.activeSignIn.agent, t)
    : null

  const modal = accounts.terminalModal
  const modalProviderLabel = modal ? getOnboardingProviderLabel(modal.agent, t) : ''

  return (
    <div className="space-y-6 pb-2">
      {connectedCount > 0 || installingCount > 0 || activeAgentLabel || queuedCount > 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/40 px-3.5 py-2 text-xs text-muted-foreground"
        >
          {connectedCount > 0 ? (
            <span className="font-medium text-foreground">
              {t('components.onboarding.aiProviders.summary.connected', '{{count}} connected', {
                count: connectedCount
              })}
            </span>
          ) : null}
          {installingCount > 0 ? (
            <span>
              {t('components.onboarding.aiProviders.summary.installing', '{{count}} installing', {
                count: installingCount
              })}
            </span>
          ) : null}
          {activeAgentLabel ? (
            <span>
              {t(
                'components.onboarding.aiProviders.summary.signingIn',
                'Signing in to {{provider}}…',
                { provider: activeAgentLabel }
              )}
            </span>
          ) : null}
          {queuedCount > 0 ? (
            <span>
              {t(
                'components.onboarding.aiProviders.summary.queued',
                '{{count}} queued for sign-in',
                { count: queuedCount }
              )}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURED_AI_PROVIDERS.map((provider) => (
          <AiProviderRow
            key={provider.agent}
            provider={provider}
            variant="card"
            detected={detectedSet.has(provider.agent)}
            platform={accounts.platform}
            connection={accounts.connections[provider.agent]}
            signInError={accounts.signInErrors[provider.agent]}
            isSigningIn={accounts.activeSignIn?.agent === provider.agent}
            isQueued={accounts.signInQueue.some((item) => item.agent === provider.agent)}
            onEnqueueSignIn={accounts.enqueueSignIn}
            onCancelSignIn={accounts.cancelActiveSignIn}
            onRemoveFromQueue={accounts.removeFromQueue}
            onOpenShellInstall={accounts.openShellInstallModal}
            onInstallingChange={handleInstallingChange}
          />
        ))}
      </div>

      <section className="space-y-2.5">
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('components.onboarding.aiProviders.otherHeading', 'Other providers')}
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/50">
          {PRIMARY_OTHER_AI_PROVIDERS.map((provider) => (
            <AiProviderRow
              key={provider.agent}
              provider={provider}
              variant="row"
              detected={detectedSet.has(provider.agent)}
              platform={accounts.platform}
              connection={accounts.connections[provider.agent]}
              signInError={accounts.signInErrors[provider.agent]}
              isSigningIn={accounts.activeSignIn?.agent === provider.agent}
              isQueued={accounts.signInQueue.some((item) => item.agent === provider.agent)}
              onEnqueueSignIn={accounts.enqueueSignIn}
              onCancelSignIn={accounts.cancelActiveSignIn}
              onRemoveFromQueue={accounts.removeFromQueue}
              onOpenShellInstall={accounts.openShellInstallModal}
              onInstallingChange={handleInstallingChange}
            />
          ))}

          <Collapsible open={showMoreOther} onOpenChange={setShowMoreOther}>
            <CollapsibleContent>
              <div className="divide-y divide-border border-t border-border">
                {MORE_OTHER_AI_PROVIDERS.map((provider) => (
                  <AiProviderRow
                    key={provider.agent}
                    provider={provider}
                    variant="row"
                    detected={detectedSet.has(provider.agent)}
                    platform={accounts.platform}
                    connection={accounts.connections[provider.agent]}
                    signInError={accounts.signInErrors[provider.agent]}
                    isSigningIn={accounts.activeSignIn?.agent === provider.agent}
                    isQueued={accounts.signInQueue.some((item) => item.agent === provider.agent)}
                    onEnqueueSignIn={accounts.enqueueSignIn}
                    onCancelSignIn={accounts.cancelActiveSignIn}
                    onRemoveFromQueue={accounts.removeFromQueue}
                    onOpenShellInstall={accounts.openShellInstallModal}
                    onInstallingChange={handleInstallingChange}
                  />
                ))}
              </div>
            </CollapsibleContent>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                {showMoreOther ? (
                  <ChevronDown className="size-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0" />
                )}
                <span>
                  {showMoreOther
                    ? t('components.onboarding.aiProviders.showFewer', 'Show fewer providers')
                    : t(
                        'components.onboarding.aiProviders.showMore',
                        'Show {{count}} more providers',
                        { count: MORE_OTHER_AI_PROVIDERS.length }
                      )}
                </span>
              </button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </section>

      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) {
            accounts.completeTerminalModal(false)
          }
        }}
      >
        <DialogContent overlayClassName="z-[120]" className="z-[130] sm:max-w-[680px]">
          {modal ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {modal.kind === 'install'
                    ? t(
                        'components.onboarding.aiProviders.dialog.installTitle',
                        'Install {{provider}}',
                        { provider: modalProviderLabel }
                      )
                    : t(
                        'components.onboarding.aiProviders.dialog.signInTitle',
                        'Sign in to {{provider}}',
                        { provider: modalProviderLabel }
                      )}
                </DialogTitle>
                <DialogDescription>
                  {modal.kind === 'install'
                    ? t(
                        'components.onboarding.aiProviders.dialog.installDescription',
                        'Finish the installer below, then click Continue to sign in.'
                      )
                    : modal.slashCommand
                      ? t(
                          'components.onboarding.aiProviders.dialog.slashSignInDescription',
                          'Once {{provider}} opens below, type {{slashCommand}} to sign in, then click Done.',
                          { provider: modalProviderLabel, slashCommand: modal.slashCommand }
                        )
                      : t(
                          'components.onboarding.aiProviders.dialog.signInDescription',
                          'Follow the sign-in prompts below. Your browser may open to finish signing in.'
                        )}
                </DialogDescription>
              </DialogHeader>
              <OnboardingInlineCommandTerminal
                key={`${modal.kind}:${modal.agent}`}
                command={modal.command}
                title={
                  modal.kind === 'install'
                    ? t(
                        'components.onboarding.aiProviders.dialog.installTitle',
                        'Install {{provider}}',
                        { provider: modalProviderLabel }
                      )
                    : t(
                        'components.onboarding.aiProviders.dialog.signInTitle',
                        'Sign in to {{provider}}',
                        { provider: modalProviderLabel }
                      )
                }
                ariaLabel={
                  modal.kind === 'install'
                    ? t(
                        'components.onboarding.aiProviders.dialog.installTitle',
                        'Install {{provider}}',
                        { provider: modalProviderLabel }
                      )
                    : t(
                        'components.onboarding.aiProviders.dialog.signInTitle',
                        'Sign in to {{provider}}',
                        { provider: modalProviderLabel }
                      )
                }
                terminalHeightPx={300}
                terminalTopMarginPx={0}
                autoScrollIntoView={false}
                worktreeId={`onboarding-provider-${modal.kind}-${modal.agent}`}
                onCommandFinished={(exitCode) => {
                  if (exitCode === 0) {
                    accounts.completeTerminalModal(true)
                  }
                }}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => accounts.completeTerminalModal(false)}
                >
                  {t('components.onboarding.aiProviders.actions.cancel', 'Cancel')}
                </Button>
                <Button type="button" onClick={() => accounts.completeTerminalModal(true)}>
                  {modal.kind === 'install'
                    ? t(
                        'components.onboarding.aiProviders.dialog.continueToSignIn',
                        'Continue to sign in'
                      )
                    : t('components.onboarding.aiProviders.dialog.done', 'Done')}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
