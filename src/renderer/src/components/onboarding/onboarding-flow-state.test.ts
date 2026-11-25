import { describe, expect, it } from 'vitest'
import { everydayChatSettingsUpdate } from './onboarding-flow-state'

describe('everydayChatSettingsUpdate', () => {
  it('turns on the Chat default when it is off', () => {
    expect(everydayChatSettingsUpdate({ agentDefaultSurface: 'terminal' })).toEqual({
      agentDefaultSurface: 'chat'
    })
  })

  it('writes nothing when Chat is already the default and no agent overrides it', () => {
    expect(
      everydayChatSettingsUpdate({
        agentDefaultSurface: 'chat',
        nativeChatProviders: { claude: true }
      })
    ).toEqual({})
  })

  it('drops per-agent CLI choices so every agent opens as Chat', () => {
    expect(
      everydayChatSettingsUpdate({
        agentDefaultSurface: 'chat',
        nativeChatProviders: { codex: false, claude: true, gemini: false }
      })
    ).toEqual({ nativeChatProviders: { claude: true } })
  })

  it('handles missing settings', () => {
    expect(everydayChatSettingsUpdate(null)).toEqual({ agentDefaultSurface: 'chat' })
  })
})
