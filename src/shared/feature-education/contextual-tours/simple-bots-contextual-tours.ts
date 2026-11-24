import type { ContextualTour } from './contextual-tours'

// Simple Bots tours only point things out: every step advances with Next, never on a user action.
export const BOTS_WELCOME_TOUR = {
  id: 'bots-welcome',
  appShell: 'simple',
  steps: [
    {
      id: 'bots-welcome-new-bot',
      title: 'Create a bot here',
      body: 'Tell it what job to do in your own words.',
      targetSelector: '[data-contextual-tour-target="simple-bots-new-bot"]',
      requiredForStart: true,
      preferredPlacement: 'bottom'
    },
    {
      id: 'bots-welcome-templates',
      title: 'Or start from a ready-made template',
      body: 'Pick a job like an email digest or meeting prep and adjust it.',
      targetSelector: '[data-contextual-tour-target="simple-bots-templates"]',
      preferredPlacement: 'bottom'
    },
    {
      id: 'bots-welcome-sidebar',
      title: 'Your bots show up here',
      body: 'Click a bot to chat with it or see what it has been doing.',
      targetSelector: '[data-contextual-tour-target="simple-bots-sidebar"]',
      preferredPlacement: 'right',
      primaryAction: { kind: 'complete', label: 'Done' },
      secondaryAction: { kind: 'open-new-bot', label: 'Create a bot' }
    }
  ]
} as const satisfies ContextualTour

export const BOTS_FIRST_BOT_TOUR = {
  id: 'bots-first-bot',
  appShell: 'simple',
  steps: [
    {
      id: 'bots-first-bot-connectors',
      title: 'Connect apps like Gmail or Slack here',
      body: 'Your bot can only use the apps you connect.',
      targetSelector: '[data-contextual-tour-target="simple-bots-connectors-tab"]',
      requiredForStart: true,
      preferredPlacement: 'bottom'
    },
    {
      id: 'bots-first-bot-composer',
      title: 'Talk to your bot here',
      body: 'Ask it to do something, or tell it how you like things done.',
      targetSelector:
        '[data-contextual-tour-target="simple-bots-chat"] [data-native-chat-composer-scope]',
      preferredPlacement: 'top'
    },
    {
      id: 'bots-first-bot-schedules',
      title: 'Schedules live in Home',
      body: 'See what your bot does on a schedule and what it did last.',
      targetSelector: '[data-contextual-tour-target="simple-bots-home-tab"]',
      preferredPlacement: 'bottom',
      primaryAction: { kind: 'complete', label: 'Done' }
    }
  ]
} as const satisfies ContextualTour
