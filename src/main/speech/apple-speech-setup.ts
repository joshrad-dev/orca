import { spawnProcess } from '@orca/process-host'
import { DICTATION_LANGUAGE_AUTO } from '../../shared/speech/models/dictation-language'
import type { SpeechModelStatus } from '../../shared/speech/speech-types'
import {
  getAppleSpeechModelState,
  invalidateAppleSpeechStatusCache,
  parseAppleSpeechEventLine,
  resolveAppleSpeechHelperPath
} from './apple-speech-helper'

export { getAppleSpeechModelState }

const PREPARE_TIMEOUT_MS = 15 * 60_000

export type SpeechDownloadTracker = Map<string, { abort: () => void; settled: Promise<void> }>

function normalizeLocaleArg(language?: string): string | undefined {
  const trimmed = language?.trim()
  if (!trimmed || trimmed === DICTATION_LANGUAGE_AUTO) {
    return undefined
  }
  return trimmed
}

export async function prepareAppleSpeech(options: {
  language?: string
  signal?: AbortSignal
  onProgress?: (progress: number) => void
}): Promise<void> {
  const helperPath = await resolveAppleSpeechHelperPath()
  if (!helperPath) {
    throw new Error('Apple Speech requires macOS 26 or later.')
  }
  const localeArg = normalizeLocaleArg(options.language)
  const args = localeArg ? ['prepare', '--locale', localeArg] : ['prepare']

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawnProcess({
      program: helperPath,
      args,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let settled = false
    let stdoutBuffer = ''
    let stderrBuffer = ''
    let helperError: string | null = null

    const finish = (err?: Error): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', onAbort)
      invalidateAppleSpeechStatusCache()
      if (err) {
        rejectPromise(err)
      } else {
        resolvePromise()
      }
    }

    const onAbort = (): void => {
      child.kill('SIGTERM')
      finish(new Error('Apple Speech setup canceled.'))
    }

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      finish(new Error('Apple Speech setup timed out.'))
    }, PREPARE_TIMEOUT_MS)
    timeout.unref?.()

    if (options.signal?.aborted) {
      onAbort()
      return
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdoutBuffer += chunk
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const event = parseAppleSpeechEventLine(line)
        if (!event) {
          continue
        }
        if (event.type === 'progress' && typeof event.progress === 'number') {
          options.onProgress?.(event.progress)
        } else if (event.type === 'error' && typeof event.error === 'string') {
          helperError = event.error
        }
      }
    })

    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      stderrBuffer += chunk
    })

    child.on('error', (error) => {
      finish(error instanceof Error ? error : new Error(String(error)))
    })

    child.on('close', (code, signal) => {
      if (stdoutBuffer.trim()) {
        const event = parseAppleSpeechEventLine(stdoutBuffer)
        if (event?.type === 'error' && typeof event.error === 'string') {
          helperError = event.error
        }
      }
      if (code === 0) {
        finish()
      } else {
        const reason = signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`
        const message =
          helperError || stderrBuffer.trim() || `Apple Speech setup failed (${reason}).`
        finish(new Error(message))
      }
    })
  })
}

export async function runAppleSpeechModelSetup(
  modelId: string,
  language: string | undefined,
  activeDownloads: SpeechDownloadTracker,
  updateState: (
    modelId: string,
    status: SpeechModelStatus,
    progress?: number,
    error?: string
  ) => void
): Promise<void> {
  updateState(modelId, 'downloading', 0)
  let aborted = false
  const abortController = new AbortController()
  const settled = Promise.withResolvers<void>()
  activeDownloads.set(modelId, {
    abort: () => {
      aborted = true
      abortController.abort()
    },
    settled: settled.promise
  })
  try {
    await prepareAppleSpeech({
      language,
      signal: abortController.signal,
      onProgress: (progress) => {
        if (!aborted) {
          updateState(modelId, 'downloading', progress)
        }
      }
    })
    if (!aborted) {
      updateState(modelId, 'ready')
    }
  } catch (err) {
    if (!aborted) {
      console.error('[speech] Apple Speech setup failed:', err)
      updateState(modelId, 'error', undefined, String(err))
      throw err
    }
  } finally {
    activeDownloads.delete(modelId)
    settled.resolve()
  }
}
