import { translate } from '@/i18n/i18n'
import type { StepCopyThunk } from './contextual-tour-step-copy'

export const SIMPLE_BOTS_TOUR_STEP_COPY = {
  'bots-welcome-new-bot': () => ({
    title: translate('components.contextualTours.botsWelcome.newBot.title', 'Create a bot here'),
    body: translate(
      'components.contextualTours.botsWelcome.newBot.body',
      'Tell it what job to do in your own words.'
    )
  }),
  'bots-welcome-templates': () => ({
    title: translate(
      'components.contextualTours.botsWelcome.templates.title',
      'Or start from a ready-made template'
    ),
    body: translate(
      'components.contextualTours.botsWelcome.templates.body',
      'Pick a job like an email digest or meeting prep and adjust it.'
    )
  }),
  'bots-welcome-sidebar': () => ({
    title: translate(
      'components.contextualTours.botsWelcome.sidebar.title',
      'Your bots show up here'
    ),
    body: translate(
      'components.contextualTours.botsWelcome.sidebar.body',
      'Click a bot to chat with it or see what it has been doing.'
    ),
    primaryActionLabel: translate('components.contextualTours.botsWelcome.sidebar.action', 'Done'),
    secondaryActionLabel: translate(
      'components.contextualTours.botsWelcome.sidebar.secondaryAction',
      'Create a bot'
    )
  }),
  'bots-first-bot-connectors': () => ({
    title: translate(
      'components.contextualTours.botsFirstBot.connectors.title',
      'Connect apps like Gmail or Slack here'
    ),
    body: translate(
      'components.contextualTours.botsFirstBot.connectors.body',
      'Your bot can only use the apps you connect.'
    )
  }),
  'bots-first-bot-composer': () => ({
    title: translate(
      'components.contextualTours.botsFirstBot.composer.title',
      'Talk to your bot here'
    ),
    body: translate(
      'components.contextualTours.botsFirstBot.composer.body',
      'Ask it to do something, or tell it how you like things done.'
    )
  }),
  'bots-first-bot-schedules': () => ({
    title: translate(
      'components.contextualTours.botsFirstBot.schedules.title',
      'Schedules live in Home'
    ),
    body: translate(
      'components.contextualTours.botsFirstBot.schedules.body',
      'See what your bot does on a schedule and what it did last.'
    ),
    primaryActionLabel: translate(
      'components.contextualTours.botsFirstBot.schedules.action',
      'Done'
    )
  })
} satisfies Record<string, StepCopyThunk>
