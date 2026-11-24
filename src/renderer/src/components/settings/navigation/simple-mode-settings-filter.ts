import type { AppShellMode } from '@/app-shell/simple-mode/app-shell-mode-store'
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

export function isSimpleModeSettingsSection(section: Pick<SettingsNavSection, 'id'>): boolean {
  return !SIMPLE_MODE_HIDDEN_SECTION_IDS.has(section.id)
}

export function filterSettingsNavSectionsForMode(
  sections: SettingsNavSection[],
  mode: AppShellMode
): SettingsNavSection[] {
  if (mode !== 'simple' || SIMPLE_MODE_HIDDEN_SECTION_IDS.size === 0) {
    return sections
  }
  return sections.filter(isSimpleModeSettingsSection)
}
