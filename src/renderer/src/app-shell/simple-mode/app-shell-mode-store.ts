import { useSyncExternalStore } from 'react'

export type AppShellMode = 'ide' | 'simple'

const STORAGE_KEY = 'orca.app-shell-mode'

function readStoredMode(): AppShellMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'simple' ? 'simple' : 'ide'
  } catch {
    return 'ide'
  }
}

let currentMode: AppShellMode = typeof window === 'undefined' ? 'ide' : readStoredMode()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAppShellMode(): AppShellMode {
  return currentMode
}

export function setAppShellMode(next: AppShellMode): void {
  if (next === currentMode) {
    return
  }
  currentMode = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Ignore storage failures in restricted contexts; in-memory mode still updates.
  }
  for (const listener of listeners) {
    listener()
  }
}

export function toggleAppShellMode(): void {
  setAppShellMode(currentMode === 'simple' ? 'ide' : 'simple')
}

export function useAppShellMode(): AppShellMode {
  return useSyncExternalStore(subscribe, getAppShellMode, () => 'ide')
}
