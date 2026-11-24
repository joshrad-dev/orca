import AVFAudio
import Foundation
import Speech

private struct BridgeError: LocalizedError {
  let message: String

  init(_ message: String) {
    self.message = message
  }

  var errorDescription: String? { message }
}

private struct StatusPayload: Encodable {
  let available: Bool
  let installed: Bool
  let locale: String?
  let supportedLanguages: [String]
}

private struct EventPayload: Encodable {
  let type: String
  let text: String?
  let progress: Double?
  let locale: String?
  let error: String?
}

private let outputLock = NSLock()

private func writeJsonLine<T: Encodable>(_ payload: T) {
  let encoder = JSONEncoder()
  guard let data = try? encoder.encode(payload) else { return }
  outputLock.lock()
  defer { outputLock.unlock() }
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write(Data([0x0A]))
  fflush(stdout)
}

private func emitEvent(
  _ type: String,
  text: String? = nil,
  progress: Double? = nil,
  locale: String? = nil,
  error: String? = nil
) {
  writeJsonLine(EventPayload(type: type, text: text, progress: progress, locale: locale, error: error))
}

private func describeError(_ error: Error) -> String {
  (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
}

private func requestedLocale(from identifier: String?) -> Locale {
  guard let raw = identifier?.trimmingCharacters(in: .whitespacesAndNewlines),
        !raw.isEmpty,
        raw.lowercased() != "auto"
  else {
    return Locale.current
  }
  return Locale(identifier: raw)
}

private func languageCode(for locale: Locale) -> String? {
  if let code = locale.language.languageCode?.identifier.lowercased(), !code.isEmpty {
    if code == "nb" || code == "nn" {
      return "no"
    }
    return code
  }
  let prefix = locale.identifier.split(whereSeparator: { $0 == "-" || $0 == "_" }).first
  return prefix.map { String($0).lowercased() }
}

@available(macOS 26.0, *)
private let inputFloatFormat = AVAudioFormat(
  commonFormat: .pcmFormatFloat32,
  sampleRate: 16_000,
  channels: 1,
  interleaved: false
)!

@available(macOS 26.0, *)
private let fallbackSpeechFormat = AVAudioFormat(
  commonFormat: .pcmFormatInt16,
  sampleRate: 16_000,
  channels: 1,
  interleaved: false
)!

// Canonical default regions when a bare ISO-639-1 code doesn't match Locale.current.
private let defaultRegionalLocales: [String: String] = [
  "de": "de-DE",
  "en": "en-US",
  "es": "es-ES",
  "fr": "fr-FR",
  "it": "it-IT",
  "pt": "pt-BR",
  "zh": "zh-CN"
]

@available(macOS 26.0, *)
private func resolveSupportedLocale(_ requested: Locale) async -> Locale? {
  let wanted = languageCode(for: requested)
  // Prefer the system locale when the caller passed a bare language code (e.g. "en" -> "en-US").
  if requested.region == nil, let wanted {
    if languageCode(for: Locale.current) == wanted,
       let currentMatch = await SpeechTranscriber.supportedLocale(equivalentTo: Locale.current)
    {
      return currentMatch
    }
    if let defaultId = defaultRegionalLocales[wanted],
       let defaultMatch = await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: defaultId))
    {
      return defaultMatch
    }
  }
  if let matched = await SpeechTranscriber.supportedLocale(equivalentTo: requested) {
    return matched
  }
  if let wanted {
    let locales = await SpeechTranscriber.supportedLocales
    return locales.first { languageCode(for: $0) == wanted }
  }
  return nil
}

@available(macOS 26.0, *)
private func supportedLanguageCodes() async -> [String] {
  let locales = await SpeechTranscriber.supportedLocales
  var codes = Set<String>()
  for locale in locales {
    if let code = languageCode(for: locale), code != "mul" {
      codes.insert(code)
    }
  }
  return codes.sorted()
}

@available(macOS 26.0, *)
private func makeSpeechAnalyzer(_ transcriber: SpeechTranscriber) -> SpeechAnalyzer {
  SpeechAnalyzer(
    modules: [transcriber],
    options: SpeechAnalyzer.Options(
      priority: .userInitiated,
      modelRetention: .lingering
    )
  )
}

@available(macOS 26.0, *)
private func ensureLocaleAssetsInstalled(
  locale: Locale,
  transcriber: SpeechTranscriber,
  reportProgress: Bool
) async throws {
  let targetId = locale.identifier(.bcp47)
  let reserved = await AssetInventory.reservedLocales
  if !reserved.contains(where: { $0.identifier(.bcp47) == targetId }) {
    // Apple caps reservations at 5 locales per app; free an older one before reserving a new locale.
    let currentId = Locale.current.identifier(.bcp47)
    var remaining = reserved.count
    for old in reserved where old.identifier(.bcp47) != targetId && old.identifier(.bcp47) != currentId {
      if remaining < 5 { break }
      await AssetInventory.release(reservedLocale: old)
      remaining -= 1
    }
    if remaining >= 5 {
      for old in reserved where old.identifier(.bcp47) != targetId {
        await AssetInventory.release(reservedLocale: old)
        remaining -= 1
        if remaining < 5 { break }
      }
    }
    _ = try? await AssetInventory.reserve(locale: locale)
  }
  let status = await AssetInventory.status(forModules: [transcriber])
  if status != .installed,
     let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber])
  {
    let progressTask: Task<Void, Never>? = reportProgress
      ? Task {
          var lastReported = -1.0
          while !Task.isCancelled {
            let fraction = min(max(request.progress.fractionCompleted, 0.0), 0.99)
            if abs(fraction - lastReported) >= 0.01 {
              lastReported = fraction
              emitEvent("progress", progress: fraction)
            }
            try? await Task.sleep(nanoseconds: 150_000_000)
          }
        }
      : nil
    defer { progressTask?.cancel() }
    try await request.downloadAndInstall()
  }
  guard await AssetInventory.status(forModules: [transcriber]) == .installed else {
    throw BridgeError("Apple Speech assets are not installed for \(locale.identifier).")
  }
}

private func runStatus(localeArg: String?) async -> Int32 {
  guard #available(macOS 26.0, *), SpeechTranscriber.isAvailable else {
    writeJsonLine(
      StatusPayload(
        available: false,
        installed: false,
        locale: nil,
        supportedLanguages: []
      )
    )
    return 0
  }

  let languages = await supportedLanguageCodes()
  let requested = requestedLocale(from: localeArg)
  let supported = await resolveSupportedLocale(requested)
  var installed = false
  if let supported {
    let transcriber = SpeechTranscriber(locale: supported, preset: .transcription)
    installed = await AssetInventory.status(forModules: [transcriber]) == .installed
  }

  writeJsonLine(
    StatusPayload(
      available: true,
      installed: installed,
      locale: supported?.identifier(.bcp47),
      supportedLanguages: languages
    )
  )
  return 0
}

private func runPrepare(localeArg: String?) async -> Int32 {
  guard #available(macOS 26.0, *), SpeechTranscriber.isAvailable else {
    emitEvent("error", error: "Apple Speech requires macOS 26 or later.")
    return 1
  }

  let requested = requestedLocale(from: localeArg)
  guard let supported = await resolveSupportedLocale(requested) else {
    emitEvent("error", error: "Apple Speech does not support \(requested.identifier).")
    return 1
  }

  do {
    let transcriber = SpeechTranscriber(locale: supported, preset: .transcription)
    try await ensureLocaleAssetsInstalled(
      locale: supported,
      transcriber: transcriber,
      reportProgress: true
    )
    let analyzer = makeSpeechAnalyzer(transcriber)
    let targetFormat =
      await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber])
      ?? fallbackSpeechFormat
    try await analyzer.prepareToAnalyze(in: targetFormat)
    emitEvent("ready", locale: supported.identifier(.bcp47))
    return 0
  } catch {
    emitEvent("error", error: describeError(error))
    return 1
  }
}

@available(macOS 26.0, *)
private func makeAudioBuffer(
  from floatBytes: Data,
  targetFormat: AVAudioFormat
) throws -> AVAudioPCMBuffer? {
  let sampleCount = floatBytes.count / MemoryLayout<Float>.size
  guard sampleCount > 0 else { return nil }

  // Fast path for the standard 16 kHz mono Int16 format returned by SpeechAnalyzer.
  if targetFormat.commonFormat == .pcmFormatInt16,
     targetFormat.sampleRate == 16_000,
     targetFormat.channelCount == 1
  {
    guard let buffer = AVAudioPCMBuffer(
      pcmFormat: targetFormat,
      frameCapacity: AVAudioFrameCount(sampleCount)
    ) else {
      throw BridgeError("Could not allocate an Apple Speech audio buffer.")
    }
    buffer.frameLength = AVAudioFrameCount(sampleCount)
    guard let channel = buffer.int16ChannelData?[0] else {
      throw BridgeError("Apple Speech did not provide a mono Int16 audio channel.")
    }
    floatBytes.withUnsafeBytes { raw in
      let floats = raw.bindMemory(to: Float.self)
      for i in 0..<sampleCount {
        let clamped = max(-1.0, min(1.0, floats[i]))
        let scaled = clamped < 0 ? clamped * 32768.0 : clamped * 32767.0
        channel[i] = Int16(scaled.rounded())
      }
    }
    return buffer
  }

  guard let sourceBuffer = AVAudioPCMBuffer(
    pcmFormat: inputFloatFormat,
    frameCapacity: AVAudioFrameCount(sampleCount)
  ) else {
    throw BridgeError("Could not allocate an input audio buffer.")
  }
  sourceBuffer.frameLength = AVAudioFrameCount(sampleCount)
  guard let sourceChannel = sourceBuffer.floatChannelData?[0] else {
    throw BridgeError("Could not access mono input audio channel.")
  }
  floatBytes.withUnsafeBytes { raw in
    guard let base = raw.baseAddress else { return }
    memcpy(sourceChannel, base, sampleCount * MemoryLayout<Float>.size)
  }

  if targetFormat == inputFloatFormat {
    return sourceBuffer
  }
  guard let converter = AVAudioConverter(from: inputFloatFormat, to: targetFormat) else {
    throw BridgeError("Could not create an audio converter for Apple Speech.")
  }
  let ratio = targetFormat.sampleRate / inputFloatFormat.sampleRate
  let outCapacity = max(1, AVAudioFrameCount(ceil(Double(sampleCount) * ratio)) + 16)
  guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: outCapacity) else {
    throw BridgeError("Could not allocate a converted Apple Speech audio buffer.")
  }
  var conversionError: NSError?
  var consumed = false
  converter.convert(to: outputBuffer, error: &conversionError) { _, outStatus in
    if consumed {
      outStatus.pointee = .noDataNow
      return nil
    }
    consumed = true
    outStatus.pointee = .haveData
    return sourceBuffer
  }
  if let conversionError {
    throw conversionError
  }
  return outputBuffer.frameLength > 0 ? outputBuffer : nil
}

private func runTranscribe(localeArg: String?, vocabulary: [String]) async -> Int32 {
  guard #available(macOS 26.0, *), SpeechTranscriber.isAvailable else {
    emitEvent("error", error: "Apple Speech requires macOS 26 or later.")
    return 1
  }

  let requested = requestedLocale(from: localeArg)
  guard let supported = await resolveSupportedLocale(requested) else {
    emitEvent("error", error: "Apple Speech does not support \(requested.identifier).")
    return 1
  }

  do {
    let transcriber = SpeechTranscriber(
      locale: supported,
      transcriptionOptions: SpeechTranscriber.Preset.transcription.transcriptionOptions,
      reportingOptions: [.volatileResults],
      attributeOptions: []
    )
    try await ensureLocaleAssetsInstalled(
      locale: supported,
      transcriber: transcriber,
      reportProgress: false
    )
    let analyzer = makeSpeechAnalyzer(transcriber)
    if !vocabulary.isEmpty {
      let context = AnalysisContext()
      context.contextualStrings[.general] = vocabulary
      try? await analyzer.setContext(context)
    }
    let targetFormat =
      await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber])
      ?? fallbackSpeechFormat
    try await analyzer.prepareToAnalyze(in: targetFormat)
    emitEvent("ready", locale: supported.identifier(.bcp47))

    let (inputStream, continuation) = AsyncStream<AnalyzerInput>.makeStream()

    let resultsTask = Task<Void, Error> {
      for try await result in transcriber.results {
        let text = String(result.text.characters).trimmingCharacters(in: .whitespacesAndNewlines)
        if result.isFinal {
          if !text.isEmpty {
            emitEvent("final", text: text)
          }
        } else {
          emitEvent("partial", text: text)
        }
      }
    }

    let readerTask = Task.detached(priority: .userInitiated) {
      let stdinFd = FileHandle.standardInput.fileDescriptor
      let chunkSize = 16_384
      var readBuffer = [UInt8](repeating: 0, count: chunkSize)
      var remainder = Data()
      while true {
        let bytesRead = read(stdinFd, &readBuffer, chunkSize)
        if bytesRead > 0 {
          remainder.append(contentsOf: readBuffer[0..<bytesRead])
          let alignedBytes = (remainder.count / MemoryLayout<Float>.size) * MemoryLayout<Float>.size
          if alignedBytes > 0 {
            let slice = remainder.prefix(alignedBytes)
            remainder.removeFirst(alignedBytes)
            if let pcmBuffer = try? makeAudioBuffer(from: Data(slice), targetFormat: targetFormat) {
              continuation.yield(AnalyzerInput(buffer: pcmBuffer))
            }
          }
        } else if bytesRead == 0 {
          break
        } else if errno == EINTR {
          continue
        } else {
          break
        }
      }
      continuation.finish()
    }

    do {
      if let lastSampleTime = try await analyzer.analyzeSequence(inputStream) {
        try await analyzer.finalizeAndFinish(through: lastSampleTime)
      } else {
        await analyzer.cancelAndFinishNow()
      }
      await readerTask.value
      try await resultsTask.value
      emitEvent("done")
      return 0
    } catch {
      readerTask.cancel()
      resultsTask.cancel()
      await analyzer.cancelAndFinishNow()
      _ = try? await resultsTask.value
      throw error
    }
  } catch {
    emitEvent("error", error: describeError(error))
    return 1
  }
}

private func parseArgs(_ args: [String]) -> (command: String, locale: String?, vocabulary: [String]) {
  let command = args.count > 1 ? args[1] : "status"
  var locale: String?
  var vocabulary: [String] = []
  var index = 2
  while index < args.count {
    let flag = args[index]
    if flag == "--locale", index + 1 < args.count {
      locale = args[index + 1]
      index += 2
    } else if flag == "--vocabulary-json", index + 1 < args.count {
      let raw = args[index + 1]
      if let data = raw.data(using: .utf8),
         let decoded = try? JSONDecoder().decode([String].self, from: data)
      {
        vocabulary = decoded
      }
      index += 2
    } else {
      index += 1
    }
  }
  return (command, locale, vocabulary)
}

@main
struct OrcaAppleSpeechMain {
  static func main() async {
    let parsed = parseArgs(CommandLine.arguments)
    let code: Int32
    switch parsed.command {
    case "status":
      code = await runStatus(localeArg: parsed.locale)
    case "prepare":
      code = await runPrepare(localeArg: parsed.locale)
    case "transcribe":
      code = await runTranscribe(localeArg: parsed.locale, vocabulary: parsed.vocabulary)
    default:
      emitEvent("error", error: "Unknown command: \(parsed.command)")
      code = 2
    }
    exit(code)
  }
}
