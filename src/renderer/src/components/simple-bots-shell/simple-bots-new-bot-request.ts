const OPEN_NEW_BOT_EVENT = 'orca:simple-bots-open-new-bot'

/** Asks the Simple Bots shell to open New bot, from outside it (the bots-welcome tour). */
export function requestSimpleBotsNewBot(): void {
  window.dispatchEvent(new Event(OPEN_NEW_BOT_EVENT))
}

export function onSimpleBotsNewBotRequest(listener: () => void): () => void {
  window.addEventListener(OPEN_NEW_BOT_EVENT, listener)
  return () => window.removeEventListener(OPEN_NEW_BOT_EVENT, listener)
}
