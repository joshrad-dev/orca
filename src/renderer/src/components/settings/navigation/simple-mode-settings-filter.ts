import type { AppShellMode } from '@/app-shell/simple-mode/app-shell-mode-store'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { CHAT_LAUNCH_DEFAULT_SECTION_ID } from '../chat/chat-launch-search'
import { getChatTurnActivityTitle } from '../chat/chat-turn-activity-search'
import { NATIVE_CHAT_CI_RESULT_LINES_SETTING_SECTION_ID } from '../chat/native-chat-ci-result-lines-setting-target'
import { NATIVE_CHAT_OPENED_PULL_REQUESTS_SETTING_SECTION_ID } from '../chat/native-chat-opened-pull-requests-setting-target'
import { NATIVE_CHAT_TURN_DIFF_SETTING_SECTION_ID } from '../chat/native-chat-turn-diff-setting-target'
import type { SettingsNavSection } from './settings-navigation-types'

// Developer-only settings hidden in Simple Bots mode.
const SIMPLE_MODE_HIDDEN_SECTION_IDS: ReadonlySet<string> = new Set([
  'git',
  'terminal',
  'mobile-emulator',
  'quick-commands',
  'floating-workspace',
  'ssh'
])

// Code/CLI-only rows hidden inside the Chat section in Simple Bots mode.
const SIMPLE_MODE_HIDDEN_CHAT_ENTRY_IDS: ReadonlySet<string> = new Set([
  CHAT_LAUNCH_DEFAULT_SECTION_ID,
  'chat-agent-launch',
  NATIVE_CHAT_TURN_DIFF_SETTING_SECTION_ID,
  NATIVE_CHAT_OPENED_PULL_REQUESTS_SETTING_SECTION_ID,
  NATIVE_CHAT_CI_RESULT_LINES_SETTING_SECTION_ID,
  'chat-shell-environment',
  'chat-match-terminal-interface'
])

export function isSimpleModeSettingsSection(section: Pick<SettingsNavSection, 'id'>): boolean {
  return !SIMPLE_MODE_HIDDEN_SECTION_IDS.has(section.id)
}

export function filterSettingsNavSectionsForMode(
  sections: SettingsNavSection[],
  mode: AppShellMode,
  t: Translate = translate
): SettingsNavSection[] {
  if (mode !== 'simple') {
    return sections
  }
  const turnActivityTitle = getChatTurnActivityTitle(t)
  return sections.filter(isSimpleModeSettingsSection).map((section) => {
    if (section.id !== 'chat') {
      return section
    }
    return {
      ...section,
      title: t('simpleBots.chat.fallbackTitle', 'Chat'),
      searchEntries: section.searchEntries?.filter(
        (entry) =>
          entry.title !== turnActivityTitle &&
          (!entry.targetSectionId || !SIMPLE_MODE_HIDDEN_CHAT_ENTRY_IDS.has(entry.targetSectionId))
      )
    }
  })
}
