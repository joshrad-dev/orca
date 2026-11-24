import { Download, Loader2, LogIn, X } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export function AiProviderStatusLine({
  isInstalling,
  isSigningIn,
  isQueued,
  isInstalled,
  isConnected,
  progress,
  installStatus,
  downloadSizeMb,
  errorText,
  label
}: {
  isInstalling: boolean
  isSigningIn: boolean
  isQueued: boolean
  isInstalled: boolean
  isConnected: boolean
  progress: number | null
  installStatus: string | null
  downloadSizeMb: number | null
  errorText: string | null
  label: string
}): React.JSX.Element | null {
  const t = useTranslate()
  if (isInstalling) {
    return (
      <div className="space-y-1.5" role="status" aria-live="polite">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <Loader2 className="size-3 shrink-0 animate-spin" />
          <span>
            {installStatus ??
              t('components.onboarding.aiProviders.status.installing', 'Installing {{provider}}…', {
                provider: label
              })}
          </span>
        </div>
        {progress !== null ? (
          <Progress
            value={progress}
            className="h-1.5"
            aria-label={t('components.managed-runtime.progress', '{{agent}} download', {
              agent: label
            })}
          />
        ) : null}
      </div>
    )
  }
  if (isSigningIn) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-3 shrink-0 animate-spin" />
        <span>
          {t(
            'components.onboarding.aiProviders.status.signingIn',
            'Waiting for you to finish signing in…'
          )}
        </span>
      </div>
    )
  }
  if (isQueued) {
    return (
      <p className="text-xs text-muted-foreground">
        {t(
          'components.onboarding.aiProviders.status.queued',
          'Installed · queued to sign in next.'
        )}
      </p>
    )
  }
  if (errorText) {
    return (
      <p role="alert" className="text-xs text-destructive">
        {errorText}
      </p>
    )
  }
  if (!isConnected && isInstalled) {
    return (
      <p className="text-xs text-muted-foreground">
        {t(
          'components.onboarding.aiProviders.status.readyToSignIn',
          'Installed on this computer · ready to sign in.'
        )}
      </p>
    )
  }
  if (!isConnected && downloadSizeMb !== null) {
    return (
      <p className="text-xs text-muted-foreground">
        {t(
          'components.onboarding.aiProviders.status.downloadNote',
          'Downloads {{provider}} (~{{size}} MB), then opens sign-in.',
          { provider: label, size: downloadSizeMb }
        )}
      </p>
    )
  }
  return null
}

export function AiProviderActionButton({
  variant,
  isConnected,
  isSigningIn,
  isQueued,
  isInstalling,
  isInstalled,
  canInstall,
  installChecking,
  canCancelInstall,
  onInstall,
  onCancelInstall,
  onSignIn,
  onCancelSignIn,
  onRemoveFromQueue
}: {
  variant: 'card' | 'row'
  isConnected: boolean
  isSigningIn: boolean
  isQueued: boolean
  isInstalling: boolean
  isInstalled: boolean
  canInstall: boolean
  installChecking: boolean
  canCancelInstall: boolean
  onInstall: () => void
  onCancelInstall: () => void
  onSignIn: () => void
  onCancelSignIn: () => void
  onRemoveFromQueue: () => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const size = variant === 'card' ? 'sm' : 'xs'
  if (isSigningIn) {
    return (
      <Button type="button" variant="ghost" size={size} onClick={onCancelSignIn}>
        <X className="size-3.5" />
        {t('components.onboarding.aiProviders.actions.cancel', 'Cancel')}
      </Button>
    )
  }
  if (isQueued) {
    return (
      <Button type="button" variant="ghost" size={size} onClick={onRemoveFromQueue}>
        <X className="size-3.5" />
        {t('components.onboarding.aiProviders.actions.cancel', 'Cancel')}
      </Button>
    )
  }
  if (isInstalling) {
    return (
      <Button
        type="button"
        variant="ghost"
        size={size}
        disabled={!canCancelInstall}
        onClick={onCancelInstall}
      >
        <X className="size-3.5" />
        {t('components.onboarding.aiProviders.actions.cancel', 'Cancel')}
      </Button>
    )
  }
  if (isConnected) {
    return null
  }
  if (isInstalled) {
    return (
      <Button type="button" variant="outline" size={size} onClick={onSignIn}>
        <LogIn className="size-3.5" />
        {t('components.onboarding.aiProviders.actions.signIn', 'Sign in')}
      </Button>
    )
  }
  if (!canInstall && !installChecking) {
    return null
  }
  return (
    <Button
      type="button"
      variant={variant === 'card' ? 'default' : 'outline'}
      size={size}
      disabled={installChecking && !canInstall}
      onClick={onInstall}
    >
      <Download className="size-3.5" />
      {t('components.onboarding.aiProviders.actions.add', 'Add')}
    </Button>
  )
}
