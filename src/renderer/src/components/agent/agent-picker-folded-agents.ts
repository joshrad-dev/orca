import { createContext } from 'react'
import type { AgentPickerEntry } from '../../../../shared/agent-launch/picker/agent-launch-picker'

/** Agent tabs a picker keeps behind a "More agents" tile until it is clicked (Bots mode). */
export const AgentPickerFoldedAgentsContext = createContext<
  ReadonlySet<AgentPickerEntry['agent']> | undefined
>(undefined)
