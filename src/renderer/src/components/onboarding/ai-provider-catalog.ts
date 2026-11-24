import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { TUI_AGENT_DISPLAY_NAMES } from '../../../../shared/agent-launch/catalog/tui-agent-display-names'
import {
  agentSessionInstallCommand,
  agentSessionSetupFor,
  agentSessionSignInCommand
} from '../../../../shared/agent-session/lifecycle/launch/agent-session-setup-commands'
import type { BotAgent } from '../../../../shared/bot-types'
import type { AgentStartupShell } from '../../../../shared/agent-launch/startup/tui-agent-startup-shell'

export type OnboardingAiProvider = {
  agent: BotAgent
  /** True when Orca ships a built-in one-click managed CLI installer for this provider. */
  managedInstall: boolean
  /** Sign-in mechanism: browser OAuth via Orca accounts IPC, or CLI command in an inline terminal. */
  signInKind: 'claude' | 'codex' | 'antigravity' | 'cli'
  getLabel: (t: Translate) => string
  getSubtitle: (t: Translate) => string
}

export const FEATURED_AI_PROVIDERS: readonly OnboardingAiProvider[] = [
  {
    agent: 'claude',
    managedInstall: true,
    signInKind: 'claude',
    getLabel: (t) => t('components.onboarding.aiProviders.featured.claude.label', 'Claude'),
    getSubtitle: (t) =>
      t(
        'components.onboarding.aiProviders.featured.claude.subtitle',
        'Anthropic · Claude Pro, Max, or API'
      )
  },
  {
    agent: 'codex',
    managedInstall: true,
    signInKind: 'codex',
    getLabel: (t) => t('components.onboarding.aiProviders.featured.chatgpt.label', 'ChatGPT'),
    getSubtitle: (t) =>
      t(
        'components.onboarding.aiProviders.featured.chatgpt.subtitle',
        'OpenAI · ChatGPT Plus, Pro, or API'
      )
  },
  {
    agent: 'antigravity',
    managedInstall: true,
    signInKind: 'antigravity',
    getLabel: (t) =>
      t('components.onboarding.aiProviders.featured.antigravity.label', 'Google (Antigravity)'),
    getSubtitle: (t) =>
      t(
        'components.onboarding.aiProviders.featured.antigravity.subtitle',
        'Google · Gemini & Antigravity account'
      )
  },
  {
    agent: 'opencode2',
    managedInstall: true,
    signInKind: 'cli',
    getLabel: (t) => t('components.onboarding.aiProviders.featured.opencode2.label', 'OpenCode 2'),
    getSubtitle: (t) =>
      t(
        'components.onboarding.aiProviders.featured.opencode2.subtitle',
        'OpenCode 2 · Multi-model providers & API keys'
      )
  }
]

const MANAGED_OTHER_AGENTS: readonly BotAgent[] = [
  'opencode',
  'copilot',
  'cursor',
  'grok',
  'kimi',
  'omp'
]

const SHELL_OTHER_AGENTS: readonly BotAgent[] = [
  'gemini',
  'pi',
  'hermes',
  'kiro',
  'goose',
  'kilo',
  'droid',
  'cline',
  'devin',
  'qwen-code',
  'aug',
  'mimo-code',
  'codebuddy'
]

function buildOtherProvider(agent: BotAgent, managedInstall: boolean): OnboardingAiProvider {
  const displayName = TUI_AGENT_DISPLAY_NAMES[agent]
  return {
    agent,
    managedInstall,
    signInKind: 'cli',
    getLabel: () => displayName,
    getSubtitle: (t) =>
      managedInstall
        ? t(
            'components.onboarding.aiProviders.other.oneClickInstall',
            'One-click install & sign in'
          )
        : t(
            'components.onboarding.aiProviders.other.cliSetup',
            'Install & sign in via setup terminal'
          )
  }
}

export const OTHER_AI_PROVIDERS: readonly OnboardingAiProvider[] = [
  ...MANAGED_OTHER_AGENTS.map((agent) => buildOtherProvider(agent, true)),
  ...SHELL_OTHER_AGENTS.map((agent) => buildOtherProvider(agent, false))
]

export const ALL_ONBOARDING_AI_PROVIDERS: readonly OnboardingAiProvider[] = [
  ...FEATURED_AI_PROVIDERS,
  ...OTHER_AI_PROVIDERS
]

export function findOnboardingAiProvider(agent: BotAgent): OnboardingAiProvider {
  return (
    ALL_ONBOARDING_AI_PROVIDERS.find((entry) => entry.agent === agent) ??
    buildOtherProvider(agent, false)
  )
}

export function getOnboardingProviderLabel(agent: BotAgent, t: Translate = translate): string {
  return findOnboardingAiProvider(agent).getLabel(t)
}

export function resolveProviderCliSignIn(
  agent: BotAgent,
  shell: AgentStartupShell | null
): { command: string; slashCommand?: string } | null {
  const command = agentSessionSignInCommand(agent, {
    account: agent === 'antigravity' ? 'system' : undefined,
    remote: false,
    shell
  })
  if (!command) {
    return null
  }
  const setup = agentSessionSetupFor(agent)
  const slashCommand = setup && 'slashCommand' in setup ? setup.slashCommand : undefined
  return { command, slashCommand }
}

export function resolveProviderCliInstallCommand(
  agent: BotAgent,
  platform: string | null | undefined
): string | null {
  return agentSessionInstallCommand(agent, platform)
}
