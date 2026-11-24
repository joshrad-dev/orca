import { access, constants } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { runProcess } from '@orca/process-host'
import { getAppEnvironment } from '../../shared/app-lifecycle/app-environment'
import { DICTATION_LANGUAGE_AUTO } from '../../shared/speech/models/dictation-language'

const HELPER_EXECUTABLE = 'orca-apple-speech'
const STATUS_TIMEOUT_MS = 5_000
const STATUS_MAX_OUTPUT_BYTES = 64 * 1024
const READINESS_CACHE_TTL_MS = 5_000

export type AppleSpeechStatus = {
  available: boolean
  installed: boolean
  locale: string | null
  supportedLanguages: string[]
}

const UNAVAILABLE_STATUS: AppleSpeechStatus = {
  available: false,
  installed: false,
  locale: null,
  supportedLanguages: []
}

type HelperEvent = {
  type?: unknown
  text?: unknown
  progress?: unknown
  locale?: unknown
  error?: unknown
}

let cachedHelperPath: Promise<string | null> | undefined
let cachedUnavailable = false
const statusCache = new Map<string, { checkedAt: number; status: AppleSpeechStatus }>()
const inflightStatus = new Map<string, Promise<AppleSpeechStatus>>()

function normalizeLocaleArg(language?: string): string | undefined {
  const trimmed = language?.trim()
  if (!trimmed || trimmed === DICTATION_LANGUAGE_AUTO) {
    return undefined
  }
  return trimmed
}

async function isExecutable(candidate: string): Promise<boolean> {
  try {
    await access(candidate, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Resolves the macOS Apple Speech helper beside Electron, or the local release build in dev. */
export function resolveAppleSpeechHelperPath(): Promise<string | null> {
  if (cachedHelperPath !== undefined) {
    return cachedHelperPath
  }
  if (process.platform !== 'darwin') {
    cachedHelperPath = Promise.resolve(null)
    return cachedHelperPath
  }
  cachedHelperPath = (async () => {
    const bundled = join(dirname(process.execPath), HELPER_EXECUTABLE)
    if (await isExecutable(bundled)) {
      return bundled
    }
    if (!getAppEnvironment().isPackaged()) {
      const devCandidates = [
        join(process.cwd(), 'native', 'apple-speech-macos', '.build', 'release', HELPER_EXECUTABLE),
        resolve(__dirname, '../../../native/apple-speech-macos/.build/release', HELPER_EXECUTABLE)
      ]
      for (const candidate of devCandidates) {
        if (await isExecutable(candidate)) {
          return candidate
        }
      }
    }
    return null
  })()
  return cachedHelperPath
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseAppleSpeechStatus(stdout: string): AppleSpeechStatus | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return null
  }
  if (!isRecord(parsed) || typeof parsed.available !== 'boolean') {
    return null
  }
  const supportedLanguages = Array.isArray(parsed.supportedLanguages)
    ? parsed.supportedLanguages.filter((value): value is string => typeof value === 'string')
    : []
  return {
    available: parsed.available,
    installed: parsed.installed === true,
    locale: typeof parsed.locale === 'string' ? parsed.locale : null,
    supportedLanguages
  }
}

export function parseAppleSpeechEventLine(line: string): HelperEvent | null {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!isRecord(parsed)) {
      return null
    }
    return {
      type: parsed.type,
      text: parsed.text,
      progress: parsed.progress,
      locale: parsed.locale,
      error: parsed.error
    }
  } catch {
    return null
  }
}

export function invalidateAppleSpeechStatusCache(): void {
  statusCache.clear()
}

export async function getAppleSpeechStatus(language?: string): Promise<AppleSpeechStatus> {
  if (process.platform !== 'darwin' || cachedUnavailable) {
    return UNAVAILABLE_STATUS
  }
  const localeArg = normalizeLocaleArg(language)
  const cacheKey = localeArg ?? ''
  const cached = statusCache.get(cacheKey)
  if (cached && Date.now() - cached.checkedAt < READINESS_CACHE_TTL_MS) {
    return cached.status
  }
  const pending = inflightStatus.get(cacheKey)
  if (pending) {
    return pending
  }
  const request = readAppleSpeechStatus(localeArg)
    .then((status) => {
      if (!status.available) {
        cachedUnavailable = true
      } else {
        statusCache.set(cacheKey, { checkedAt: Date.now(), status })
      }
      return status
    })
    .finally(() => {
      inflightStatus.delete(cacheKey)
    })
  inflightStatus.set(cacheKey, request)
  return request
}

async function readAppleSpeechStatus(localeArg: string | undefined): Promise<AppleSpeechStatus> {
  const helperPath = await resolveAppleSpeechHelperPath()
  if (!helperPath) {
    return UNAVAILABLE_STATUS
  }
  const args = localeArg ? ['status', '--locale', localeArg] : ['status']
  try {
    const result = await runProcess({
      program: helperPath,
      args,
      timeoutMs: STATUS_TIMEOUT_MS,
      maxOutputBytes: STATUS_MAX_OUTPUT_BYTES
    })
    if (result.code !== 0 || result.timedOut) {
      return UNAVAILABLE_STATUS
    }
    return parseAppleSpeechStatus(result.stdout.trim()) ?? UNAVAILABLE_STATUS
  } catch {
    return UNAVAILABLE_STATUS
  }
}

export async function isAppleSpeechAvailable(): Promise<boolean> {
  const status = await getAppleSpeechStatus()
  return status.available
}

export async function getAppleSpeechModelState(
  modelId: string,
  language?: string
): Promise<{ id: string; status: 'ready' | 'not-downloaded' }> {
  const status = await getAppleSpeechStatus(language)
  const ready = status.available && status.installed
  return { id: modelId, status: ready ? 'ready' : 'not-downloaded' }
}
