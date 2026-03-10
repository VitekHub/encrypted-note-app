import { argon2id } from 'hash-wasm'
import type { Argon2CalibrationService, CalibrationResult, Argon2Params } from './types'

/** Target derivation time range in milliseconds. */
const TARGET_MIN_MS = 800
const TARGET_MAX_MS = 2000
const TARGET_IDEAL_MS = 1250 // aim roughly for middle of range
const EARLY_ACCEPT_BELOW = TARGET_MIN_MS * 0.92 // 736 ms
const MIN_ACCEPTABLE_MS = 550 // still better than fallback

/** Maximum time allowed for the entire calibration process (15 seconds). */
const TOTAL_CALIBRATION_BUDGET_MS = 15_000

/** Maximum memory the calibration will ever try (512 MiB in KiB). */
const MAX_MEMORY_KIB = 512 * 1024

/** Minimum memory floor (64 MiB in KiB). */
const MIN_MEMORY_KIB = 64 * 1024

/** Maximum iterations for tuning (Phase 3). */
const MAX_ITERATIONS = 10

/** Minimum granularity for the binary-search step (1 MiB in KiB). */
const BINARY_SEARCH_PRECISION_KIB = 1024

/** Safe fallback parameters if calibration fails or times out. */
export const FALLBACK_ARGON2_PARAMS: Argon2Params = {
  iterations: 3,
  memorySize: 64 * 1024, // 64 MiB in KiB
  parallelism: 4,
  hashLength: 32,
}

/** Default hash length for calibration. */
const DEFAULT_HASH_LENGTH = 32

/** Dummy values used exclusively during calibration benchmarks. */
const CALIBRATION_PASSWORD = 'calibration-benchmark'
const CALIBRATION_SALT = new Uint8Array(16) // all-zero salt, fine for timing

/**
 * Detects the optimal parallelism for the current device.
 * Capped between 1 and 8.
 */
function getParallelism(): number {
  return Math.max(1, Math.min(8, navigator.hardwareConcurrency ?? 4))
}

/**
 * Runs a single Argon2id derivation with the given parameters and
 * returns the wall-clock time in milliseconds.
 *
 * @param {Argon2Params} params - The Argon2id parameters to benchmark
 * @returns {Promise<number>} Duration in milliseconds
 */
async function benchmark(params: Argon2Params): Promise<number> {
  const start = performance.now()
  await argon2id({
    password: CALIBRATION_PASSWORD,
    salt: CALIBRATION_SALT,
    iterations: params.iterations,
    memorySize: params.memorySize,
    parallelism: params.parallelism,
    hashLength: params.hashLength,
    outputType: 'hex',
  })
  return performance.now() - start
}

/**
 * Phase 3: Increment iterations if there is still "room" in the time budget.
 * Helps strengthen the hash on fast devices where max memory is still quick.
 */
async function tuneIterations(result: CalibrationResult, startTime: number): Promise<CalibrationResult> {
  let { params, durationMs } = result
  const isWithinBudget = () => performance.now() - startTime < TOTAL_CALIBRATION_BUDGET_MS

  // Early accept if already very close
  if (durationMs >= EARLY_ACCEPT_BELOW) {
    return { params: { ...params }, durationMs }
  }

  // Try to climb iterations
  while (params.iterations < MAX_ITERATIONS && durationMs < TARGET_IDEAL_MS && isWithinBudget()) {
    const candidate = { ...params, iterations: params.iterations + 1 }
    const nextDuration = await benchmark(candidate)

    // Accept only if not clearly overshooting
    if (nextDuration > TARGET_MAX_MS * 1.15) break // 15% overshoot tolerance
    if (nextDuration < MIN_ACCEPTABLE_MS) break // something is wrong

    params = candidate
    durationMs = Math.round(nextDuration)

    // Sweet spot — stop early if good enough
    if (durationMs >= TARGET_MIN_MS && durationMs <= TARGET_MAX_MS) {
      break
    }
  }

  return { params: { ...params }, durationMs }
}

export const argon2CalibrationService: Argon2CalibrationService = {
  /** @inheritdoc */
  async calibrate(): Promise<CalibrationResult> {
    const startTime = performance.now()
    const parallelism = getParallelism()

    const isWithinBudget = () => performance.now() - startTime < TOTAL_CALIBRATION_BUDGET_MS

    try {
      // Phase 1 — exponential doubling of memorySize until we exceed the target
      let lastFastMemory = MIN_MEMORY_KIB
      let firstSlowMemory: number | null = null
      let lastDuration = 0

      let memory = MIN_MEMORY_KIB
      while (memory <= MAX_MEMORY_KIB && isWithinBudget()) {
        const params: Argon2Params = {
          iterations: 3,
          memorySize: memory,
          parallelism,
          hashLength: DEFAULT_HASH_LENGTH,
        }
        const duration = await benchmark(params)

        if (duration >= TARGET_MIN_MS && duration <= TARGET_MAX_MS) {
          return tuneIterations({ params, durationMs: Math.round(duration) }, startTime)
        }

        if (duration < TARGET_MIN_MS) {
          lastFastMemory = memory
          lastDuration = duration
        } else {
          firstSlowMemory = memory
          break
        }

        memory *= 2
      }

      if (!isWithinBudget()) throw new Error('Calibration timeout during Phase 1')

      let phase2Result: CalibrationResult

      if (firstSlowMemory === null) {
        phase2Result = {
          params: {
            iterations: 3,
            memorySize: lastFastMemory,
            parallelism,
            hashLength: DEFAULT_HASH_LENGTH,
          },
          durationMs: Math.round(lastDuration),
        }
      } else {
        // Phase 2 — binary search between lastFastMemory and firstSlowMemory
        let lo = lastFastMemory
        let hi = firstSlowMemory
        phase2Result = {
          params: {
            iterations: 3,
            memorySize: lo,
            parallelism,
            hashLength: DEFAULT_HASH_LENGTH,
          },
          durationMs: Math.round(lastDuration),
        }

        while (hi - lo > BINARY_SEARCH_PRECISION_KIB && isWithinBudget()) {
          const mid = Math.floor((lo + hi) / 2)
          const params: Argon2Params = {
            iterations: 3,
            memorySize: mid,
            parallelism,
            hashLength: DEFAULT_HASH_LENGTH,
          }
          const duration = await benchmark(params)

          if (duration >= TARGET_MIN_MS && duration <= TARGET_MAX_MS) {
            return tuneIterations({ params, durationMs: Math.round(duration) }, startTime)
          }

          if (duration < TARGET_MIN_MS) {
            lo = mid
            phase2Result = { params, durationMs: Math.round(duration) }
          } else {
            hi = mid
          }
        }
      }

      if (!isWithinBudget()) throw new Error('Calibration timeout during Phase 2')

      // Phase 3 — Iteration tuning
      return tuneIterations(phase2Result, startTime)
    } catch {
      return {
        params: FALLBACK_ARGON2_PARAMS,
        durationMs: 0, // Duration unknown for fallback
      }
    }
  },
}
