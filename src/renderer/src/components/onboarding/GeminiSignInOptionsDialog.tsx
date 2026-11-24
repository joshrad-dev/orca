import { useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { PortalContainerContext } from '@/components/ui/portal-container-context'
import { useManagedRuntimeInstall } from '@/runtime/hosts/installation/use-managed-runtime-install'
import { AntigravityProviderSignInArea } from '@/components/provider-accounts/AntigravityProviderSignInArea'
import { antigravityProviderSignInShown } from '@/components/provider-accounts/antigravity-chat-runtime-sign-in-policy'
import {
  getHostRuntimeLabel,
  getRuntimeSentenceLabel
} from '@/lib/provider-accounts/account-runtime-label'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'

const LOCAL_OWNER: RuntimeClientTarget = { kind: 'local' }

/** Orca's Google sign-in chooser (Google account, Gemini Enterprise, Gemini API key, Agent Platform)
 *  over onboarding, for someone whose work gave them a key instead of a Google login. */
export function GeminiSignInOptionsDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const t = useTranslate()
  const install = useManagedRuntimeInstall(LOCAL_OWNER, 'antigravity', open)
  // Why: the dialog is transformed, so its Select menus portal to an untransformed layer above it.
  const [menuLayer, setMenuLayer] = useState<HTMLDivElement | null>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[120]" className="z-[130] sm:max-w-[520px]">
        <PortalContainerContext.Provider value={menuLayer}>
          <DialogHeader>
            <DialogTitle>
              {t('components.onboarding.aiProviders.geminiOptions.title', 'Other ways to sign in')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'components.onboarding.aiProviders.geminiOptions.description',
                'Use a work account or a Gemini API key from your company instead of a personal Google account.'
              )}
            </DialogDescription>
          </DialogHeader>
          {install.kind === 'active' && antigravityProviderSignInShown(install) ? (
            <AntigravityProviderSignInArea
              owner={LOCAL_OWNER}
              label={getRuntimeSentenceLabel({ runtime: 'host', label: getHostRuntimeLabel(t) })}
              install={install}
            />
          ) : null}
          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t('components.onboarding.aiProviders.dialog.done', 'Done')}
            </Button>
          </DialogFooter>
        </PortalContainerContext.Provider>
      </DialogContent>
      {open ? (
        <div
          ref={setMenuLayer}
          className="pointer-events-none fixed inset-0 z-[140] [&>*]:pointer-events-auto"
        />
      ) : null}
    </Dialog>
  )
}
