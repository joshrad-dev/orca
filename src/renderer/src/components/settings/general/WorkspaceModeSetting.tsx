import { Bot, Code2 } from 'lucide-react'
import {
  setAppShellMode,
  useAppShellMode,
  type AppShellMode
} from '@/app-shell/simple-mode/app-shell-mode-store'
import { useTranslate } from '@/i18n/use-translate'
import { SettingsRow, SettingsSegmentedControl } from '../form-controls/SettingsFormControls'
import { SettingsGroup } from '../section-layout/SettingsGroup'
import { GENERAL_WORKSPACE_MODE_SECTION_ID } from './general-search'

export function WorkspaceModeSetting(): React.JSX.Element {
  const t = useTranslate()
  const mode = useAppShellMode()
  const label = t('simpleBots.mode.label', 'Workspace mode')
  const options: readonly { value: AppShellMode; label: React.ReactNode }[] = [
    {
      value: 'simple',
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Bot className="size-3.5 shrink-0" />
          <span>{t('simpleBots.mode.bots', 'Bots')}</span>
        </span>
      )
    },
    {
      value: 'ide',
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Code2 className="size-3.5 shrink-0" />
          <span>{t('simpleBots.mode.code', 'Code')}</span>
        </span>
      )
    }
  ]

  return (
    <div id={GENERAL_WORKSPACE_MODE_SECTION_ID} className="scroll-mt-8">
      <SettingsGroup>
        <SettingsRow
          label={label}
          description={t(
            'simpleBots.mode.description',
            'Choose whether Orca centers on Bots for everyday work or the full Code workspace.'
          )}
          control={
            <SettingsSegmentedControl
              value={mode}
              onChange={setAppShellMode}
              options={options}
              ariaLabel={label}
            />
          }
        />
      </SettingsGroup>
    </div>
  )
}
