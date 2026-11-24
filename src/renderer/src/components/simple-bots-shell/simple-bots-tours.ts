import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { getAppShellMode } from '@/app-shell/simple-mode/app-shell-mode-store'
import { requestContextualTourWhenReady } from '@/components/contextual-tours/request-contextual-tour-when-ready'

// Long enough for onboarding to close and the Simple Bots shell to paint its empty state.
const SHELL_SETTLE_ATTEMPTS = 50

/** After Everyday onboarding: shows where bots are made, once the empty state is on screen. */
export function requestBotsWelcomeTour(): void {
  if (useAppStore.getState().contextualToursSeenIds.includes('bots-welcome')) {
    return
  }
  requestContextualTourWhenReady({
    id: 'bots-welcome',
    source: 'everyday_onboarding_completed',
    wasFeaturePreviouslyInteracted: false,
    maxAttempts: SHELL_SETTLE_ATTEMPTS,
    shouldContinue: () => getAppShellMode() === 'simple'
  })
}

/** The first time a bot is open with its side panel showing: where connectors, chat and schedules are.
 *  For first-run profiles and anyone who saw bots-welcome. Forced past the one-tour-per-session limit,
 *  since it follows bots-welcome in the same session by design. */
export function useBotsFirstBotTour(visible: boolean): void {
  const seen = useAppStore((s) => s.contextualToursSeenIds.includes('bots-first-bot'))
  const eligible = useAppStore(
    (s) =>
      s.contextualToursAutoEligible === true || s.contextualToursSeenIds.includes('bots-welcome')
  )
  // Re-request once another tour or a modal clears, instead of giving up after the retries.
  const clear = useAppStore((s) => s.activeContextualTourId === null && s.activeModal === 'none')
  useEffect(() => {
    if (!visible || seen || !eligible || !clear) {
      return
    }
    return requestContextualTourWhenReady({
      id: 'bots-first-bot',
      source: 'simple_bots_bot_open',
      wasFeaturePreviouslyInteracted: false,
      maxAttempts: SHELL_SETTLE_ATTEMPTS
    })
  }, [clear, eligible, seen, visible])
}
