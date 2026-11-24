import { defineFixture } from '../../component-fixtures/component-fixture'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { AiProvidersStep } from './AiProvidersStep'

export const freshMachine = defineFixture({
  width: 1036,
  render: () => <AiProvidersStep detectedSet={new Set<TuiAgent>()} />
})

export const someInstalled = defineFixture({
  width: 1036,
  render: () => (
    <AiProvidersStep detectedSet={new Set<TuiAgent>(['claude', 'opencode2', 'cursor'])} />
  )
})
