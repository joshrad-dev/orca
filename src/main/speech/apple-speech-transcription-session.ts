import type { ChildProcess } from 'node:child_process'
import { spawnProcess } from '@orca/process-host'
import {
  LOCAL_DICTATION_STOP_TIMEOUT_MS,
  START_DICTATION_TIMEOUT_MS
} from '../../shared/speech/dictation/dictation-finish-deadlines'
import { DICTATION_LANGUAGE_AUTO } from '../../shared/speech/models/dictation-language'
import {
  invalidateAppleSpeechStatusCache,
  parseAppleSpeechEventLine,
  resolveAppleSpeechHelperPath
} from './apple-speech-helper'
import { resampleToRate } from './stt-audio-resample'
import type { SttEventSink } from './stt-service'

const APPLE_SPEECH_SAMPLE_RATE = 16_000

export class AppleSpeechTranscriptionSession {
  private child: ChildProcess | null = null
  private canceled = false
  private finished = false
  private closed = false
  private stdoutBuffer = ''
  private stderrBuffer = ''
  private helperError: string | null = null
  private readySettled = false
  private readonly readyResolvers = Promise.withResolvers<void>()
  private readonly exitResolvers = Promise.withResolvers<void>()

  constructor(
    private readonly sink: SttEventSink,
    private readonly language?: string,
    private readonly vocabulary: readonly string[] = []
  ) {}

  async start(): Promise<void> {
    const helperPath = await resolveAppleSpeechHelperPath()
    if (!helperPath) {
      throw new Error('Apple Speech requires macOS 26 or later.')
    }
    const args = ['transcribe']
    const locale = this.language?.trim()
    if (locale && locale !== DICTATION_LANGUAGE_AUTO) {
      args.push('--locale', locale)
    }
    if (this.vocabulary.length > 0) {
      args.push('--vocabulary-json', JSON.stringify(this.vocabulary))
    }

    const child = spawnProcess({
      program: helperPath,
      args,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.child = child

    child.stdin?.on('error', () => {
      // Pipe errors during shutdown or cancel are expected.
    })

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      this.handleStdoutChunk(chunk)
    })

    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      this.stderrBuffer += chunk
    })

    child.on('error', (error) => {
      const err = error instanceof Error ? error : new Error(String(error))
      this.failBeforeOrAfterReady(err.message)
      this.closed = true
      this.exitResolvers.resolve()
    })

    child.on('close', (code, signal) => {
      if (this.stdoutBuffer.trim()) {
        this.handleEventLine(this.stdoutBuffer)
        this.stdoutBuffer = ''
      }
      this.closed = true
      if (!this.canceled && code !== 0) {
        const reason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`
        const message =
          this.helperError ||
          this.stderrBuffer.trim() ||
          `Apple Speech exited unexpectedly (${reason}).`
        this.failBeforeOrAfterReady(message)
      } else if (!this.readySettled) {
        this.readySettled = true
        this.readyResolvers.reject(new Error('Apple Speech exited before becoming ready.'))
      }
      this.exitResolvers.resolve()
    })

    const timeout = setTimeout(() => {
      if (!this.readySettled) {
        this.readySettled = true
        this.terminateChild()
        this.readyResolvers.reject(new Error('Apple Speech timed out while starting.'))
      }
    }, START_DICTATION_TIMEOUT_MS)
    timeout.unref?.()

    try {
      await this.readyResolvers.promise
      invalidateAppleSpeechStatusCache()
    } finally {
      clearTimeout(timeout)
    }
  }

  feedAudio(samples: Float32Array, sampleRate: number): boolean {
    if (this.canceled || this.finished || this.closed || !this.child?.stdin?.writable) {
      return false
    }
    const normalized = resampleToRate(samples, sampleRate, APPLE_SPEECH_SAMPLE_RATE)
    if (normalized.length === 0) {
      return false
    }
    const payload = Buffer.from(normalized.buffer, normalized.byteOffset, normalized.byteLength)
    this.child.stdin.write(payload)
    return false
  }

  async finish(): Promise<void> {
    if (this.canceled || this.finished) {
      return
    }
    this.finished = true
    if (this.closed) {
      return
    }
    try {
      this.child?.stdin?.end()
    } catch {
      // Stdin may already be closed.
    }
    const timeout = setTimeout(() => {
      if (!this.closed) {
        this.terminateChild()
      }
    }, LOCAL_DICTATION_STOP_TIMEOUT_MS)
    timeout.unref?.()
    try {
      await this.exitResolvers.promise
    } finally {
      clearTimeout(timeout)
    }
  }

  cancel(): void {
    if (this.canceled) {
      return
    }
    this.canceled = true
    this.finished = true
    if (!this.readySettled) {
      this.readySettled = true
      this.readyResolvers.reject(new Error('dictation_canceled'))
    }
    this.terminateChild()
  }

  private terminateChild(): void {
    const child = this.child
    if (!child || this.closed) {
      return
    }
    try {
      child.stdin?.destroy()
    } catch {
      // Ignore already-closed stdin.
    }
    try {
      child.kill('SIGTERM')
    } catch {
      // Child already exited.
    }
  }

  private handleStdoutChunk(chunk: string): void {
    this.stdoutBuffer += chunk
    const lines = this.stdoutBuffer.split('\n')
    this.stdoutBuffer = lines.pop() ?? ''
    for (const line of lines) {
      this.handleEventLine(line)
    }
  }

  private handleEventLine(line: string): void {
    if (this.canceled) {
      return
    }
    const event = parseAppleSpeechEventLine(line)
    if (!event || typeof event.type !== 'string') {
      return
    }
    switch (event.type) {
      case 'ready':
        if (!this.readySettled) {
          this.readySettled = true
          this.readyResolvers.resolve()
        }
        break
      case 'partial':
        this.sink({ type: 'partial', text: typeof event.text === 'string' ? event.text : '' })
        break
      case 'final':
        if (typeof event.text === 'string' && event.text.trim()) {
          this.sink({ type: 'final', text: event.text })
        }
        break
      case 'error':
        if (typeof event.error === 'string' && event.error.trim()) {
          this.helperError = event.error.trim()
          this.failBeforeOrAfterReady(this.helperError)
        }
        break
      case 'done':
        break
    }
  }

  private failBeforeOrAfterReady(message: string): void {
    if (this.canceled) {
      return
    }
    if (!this.readySettled) {
      this.readySettled = true
      this.readyResolvers.reject(new Error(message))
    } else {
      this.sink({ type: 'error', error: message })
    }
  }
}
