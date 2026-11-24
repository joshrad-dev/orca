import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { applyDocumentTheme } from '@/app-shell/appearance/document-theme'
import { track } from '@/diagnostics/telemetry/telemetry'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import { getExecutionHostIdForWorktree } from '@/lib/workspace/ownership/worktree-runtime-owner'
import { launchOnboardingCompletionAgent } from './onboarding-completion-agent-launch'
import { ONBOARDING_FINAL_STEP } from '../../../../shared/onboarding/onboarding-defaults'
import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import type { OnboardingState } from '../../../../shared/onboarding/onboarding-state-types'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { buildWindowsTerminalSnapshotPayload } from './windows-terminal-onboarding-telemetry'
import { persistStep, type PersistCurrentStepResult } from './use-onboarding-flow-persistence'
import {
  STEPS,
  type AgentSurface,
  type OnboardingUseCase,
  type StepNumber
} from './use-onboarding-flow-types'
import { captureThemeLookSettings } from './onboarding-theme-look-settings'
import {
  persistSkippedStepProgress,
  prepareSkippedOnboardingPreferences,
  resolveStepIndex,
  type OnboardingStepSkipOptions,
  type TaskSourcesExitAction
} from './onboarding-flow-state'

type CloseWith = (
  outcome: 'completed' | 'dismissed',
  lastStepReached: StepNumber,
  completedPath?: 'add_project_modal' | 'workspace',
  dismissedExtras?: { advancedVia: 'button' | 'keyboard'; durationMs: number }
) => Promise<boolean>

type OnboardingFlowActionsArgs = {
  busyLabel: string | null
  setBusyLabel: Dispatch<SetStateAction<string | null>>
  setError: Dispatch<SetStateAction<string | null>>
  currentStep: (typeof STEPS)[number]
  consumeStepDurationMs: () => number
  trackTaskSourcesSnapshot: (
    exitAction: TaskSourcesExitAction,
    durationMs: number,
    advancedVia: 'button' | 'keyboard'
  ) => void
  settings: GlobalSettings | null
  persistCurrentStep: () => Promise<PersistCurrentStepResult>
  selectedWorkspaceId: string | null
  closeWith: CloseWith
  openModal: (modal: 'add-repo') => void
  getNextStepIndex: (index: number) => number
  onOnboardingChange: (state: OnboardingState) => void
  stepIndex: number
  setStepIndex: Dispatch<SetStateAction<number>>
  useCase: OnboardingUseCase
  selectedAgent: TuiAgent | null
  agentSurface: AgentSurface
  themeLookBaseline: GlobalSettings | null
  setTheme: Dispatch<SetStateAction<GlobalSettings['theme']>>
  updateSettings: (updates: Partial<GlobalSettings>) => Promise<void> | void
  skipOptions: OnboardingStepSkipOptions
}

function resolveWorktreeExecutionHostId(worktreeId: string | null) {
  return worktreeId ? getExecutionHostIdForWorktree(useAppStore.getState(), worktreeId) : undefined
}

export function useOnboardingFlowActions({
  busyLabel,
  setBusyLabel,
  setError,
  currentStep,
  consumeStepDurationMs,
  trackTaskSourcesSnapshot,
  settings,
  persistCurrentStep,
  selectedWorkspaceId: worktreeId,
  closeWith,
  openModal,
  getNextStepIndex,
  onOnboardingChange,
  stepIndex,
  setStepIndex,
  useCase,
  selectedAgent,
  agentSurface,
  themeLookBaseline,
  setTheme,
  updateSettings,
  skipOptions
}: OnboardingFlowActionsArgs) {
  // Latch synchronously: busyLabel commits too late to stop shortcut autorepeat from skipping a step.
  const nextInFlightRef = useRef(false)
  const trackStepExitSnapshots = useCallback(
    (
      stepId: (typeof STEPS)[number]['id'],
      exitAction: TaskSourcesExitAction,
      durationMs: number,
      advancedVia: 'button' | 'keyboard'
    ): void => {
      if (stepId === 'integrations') {
        trackTaskSourcesSnapshot(exitAction, durationMs, advancedVia)
      }
      if (stepId === 'windows_terminal') {
        track(
          'onboarding_windows_terminal_snapshot',
          buildWindowsTerminalSnapshotPayload({ settings, exitAction, durationMs, advancedVia })
        )
      }
    },
    [settings, trackTaskSourcesSnapshot]
  )

  const trackCurrentStepCompleted = useCallback(
    (advancedVia: 'button' | 'keyboard'): void => {
      // Step 1 spans use_case and its follow-up page (ai_providers or agent); only the final page completes it.
      if (currentStep.id === 'agent_surface' || currentStep.id === 'use_case') {
        return
      }
      const durationMs = consumeStepDurationMs()
      track('onboarding_step_completed', {
        step: currentStep.stepNumber,
        value_kind: currentStep.valueKind,
        duration_ms: durationMs,
        advanced_via: advancedVia
      })
      trackStepExitSnapshots(currentStep.id, 'continue', durationMs, advancedVia)
    },
    [consumeStepDurationMs, currentStep, trackStepExitSnapshots]
  )
  const complete = useCallback(
    async (
      workspaceExecutionHostId: Parameters<typeof launchOnboardingCompletionAgent>[2],
      path: 'workspace' | 'add_project_modal',
      agent?: TuiAgent | null
    ): Promise<boolean> => {
      const closed = await closeWith('completed', ONBOARDING_FINAL_STEP, path)
      if (closed && useCase === 'everyday') {
        return closed
      }
      if (closed && !worktreeId && path === 'add_project_modal') {
        openModal('add-repo')
      } else if (closed && worktreeId) {
        await launchOnboardingCompletionAgent(worktreeId, agent, workspaceExecutionHostId)
      }
      return closed
    },
    [closeWith, openModal, useCase, worktreeId]
  )

  const next = useCallback(
    async (advancedVia: 'button' | 'keyboard' = 'button') => {
      if (nextInFlightRef.current || busyLabel) {
        return
      }
      nextInFlightRef.current = true
      const workspaceExecutionHostId = resolveWorktreeExecutionHostId(worktreeId)
      try {
        const result = await persistCurrentStep()
        if (result.ok) {
          trackCurrentStepCompleted(advancedVia)
          if (currentStep.id === 'notifications') {
            if (useCase === 'everyday') {
              setBusyLabel(
                translate('components.onboarding.flow.actions.getStarted', 'Get started')
              )
              await complete(workspaceExecutionHostId, 'workspace', null)
              return
            }
            setBusyLabel(
              worktreeId
                ? translate('components.onboarding.flow.actions.continue', 'Continue')
                : translate(
                    'components.onboarding.flow.actions.openingAddProject',
                    'Opening Add Project...'
                  )
            )
            await complete(
              workspaceExecutionHostId,
              worktreeId ? 'workspace' : 'add_project_modal',
              selectedAgent
            )
            return
          }
          const nextIndex = getNextStepIndex(stepIndex)
          const skippedThroughStepNumber = STEPS[nextIndex].stepNumber - 1
          if (skippedThroughStepNumber > currentStep.stepNumber) {
            // Why: skipped optional pages must still persist progress at the next visible page.
            await persistSkippedStepProgress(
              skippedThroughStepNumber,
              persistStep,
              onOnboardingChange
            )
          }
          setStepIndex(nextIndex)
        }
      } finally {
        setBusyLabel(null)
        nextInFlightRef.current = false
      }
    },
    [
      busyLabel,
      complete,
      currentStep.id,
      currentStep.stepNumber,
      getNextStepIndex,
      worktreeId,
      selectedAgent,
      onOnboardingChange,
      persistCurrentStep,
      stepIndex,
      trackCurrentStepCompleted,
      useCase,
      setBusyLabel,
      setStepIndex
    ]
  )

  const setUpLater = useCallback(async () => {
    if (nextInFlightRef.current || busyLabel || currentStep.id === 'notifications') {
      return
    }
    nextInFlightRef.current = true
    const workspaceExecutionHostId = resolveWorktreeExecutionHostId(worktreeId)
    const { id: stepId, stepNumber, valueKind } = currentStep
    const agent = stepId === 'agent' ? selectedAgent : undefined
    const durationMs = consumeStepDurationMs()
    setError(null)
    setBusyLabel(translate('components.onboarding.flow.actions.continue', 'Continue'))
    try {
      const preferencesSaved = await prepareSkippedOnboardingPreferences({
        currentStepId: stepId,
        useCase,
        lookBeforePreview: themeLookBaseline ? captureThemeLookSettings(themeLookBaseline) : null,
        settingsTheme: settings?.theme,
        selectedAgent,
        agentSurface,
        settings,
        setTheme,
        applyTheme: applyDocumentTheme,
        updateSettings,
        setError
      })
      if (!preferencesSaved || !(await complete(workspaceExecutionHostId, 'workspace', agent))) {
        return
      }
      track('onboarding_step_skipped', {
        step: stepNumber,
        value_kind: valueKind,
        duration_ms: durationMs,
        advanced_via: 'button'
      })
      trackStepExitSnapshots(stepId, 'skip_to_project_setup', durationMs, 'button')
    } finally {
      setBusyLabel(null)
      nextInFlightRef.current = false
    }
  }, [
    busyLabel,
    complete,
    consumeStepDurationMs,
    currentStep,
    agentSurface,
    selectedAgent,
    settings,
    trackStepExitSnapshots,
    updateSettings,
    useCase,
    setBusyLabel,
    setError,
    setTheme,
    themeLookBaseline,
    worktreeId
  ])

  const dismissOnboarding = useCallback(
    async (advancedVia: 'button' | 'keyboard' = 'button'): Promise<boolean> => {
      if (busyLabel) {
        return false
      }
      setError(null)
      return closeWith('dismissed', currentStep.stepNumber, undefined, {
        durationMs: consumeStepDurationMs(),
        advancedVia
      })
    },
    [busyLabel, closeWith, consumeStepDurationMs, currentStep.stepNumber, setError]
  )

  const back = useCallback(() => {
    setStepIndex((index) => resolveStepIndex(index - 1, skipOptions, 'backward'))
  }, [setStepIndex, skipOptions])

  const jumpToStep = useCallback(
    (idx: number) => {
      setStepIndex(resolveStepIndex(idx, skipOptions, idx < stepIndex ? 'backward' : 'forward'))
    },
    [setStepIndex, skipOptions, stepIndex]
  )

  return { next, setUpLater, dismissOnboarding, back, jumpToStep }
}
