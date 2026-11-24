import { useEffect, useState } from 'react'
import type { BotAgent } from '../../../../shared/bot-types'
import { FEATURED_AI_PROVIDERS } from '../onboarding/ai-provider-catalog'
import { readProviderConnection } from '../onboarding/onboarding-provider-connections'

const FEATURED_AGENTS: readonly BotAgent[] = FEATURED_AI_PROVIDERS.map((provider) => provider.agent)
const NONE: readonly BotAgent[] = []

async function readConnectedFeaturedAgents(): Promise<BotAgent[]> {
  const connected = await Promise.all(
    FEATURED_AGENTS.map((agent) =>
      readProviderConnection(agent).then(
        (connection) => (connection?.connected ? agent : null),
        () => null
      )
    )
  )
  return connected.filter((agent): agent is BotAgent => agent !== null)
}

/** Featured providers signed in on this computer, in featured order. Read while `enabled`, and again
 *  each time `open` turns on, so a sign-in made in Settings is picked up by the next New bot. */
export function useConnectedFeaturedAgents(enabled: boolean, open: boolean): readonly BotAgent[] {
  const [connected, setConnected] = useState<readonly BotAgent[]>(NONE)
  useEffect(() => {
    if (!enabled) {
      return
    }
    let cancelled = false
    void readConnectedFeaturedAgents().then((agents) => {
      if (!cancelled) {
        setConnected(agents)
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled, open])
  return enabled ? connected : NONE
}
