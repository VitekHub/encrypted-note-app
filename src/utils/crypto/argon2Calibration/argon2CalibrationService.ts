/**
 * Argon2id calibration service.
 *
 * Benchmarks the current device to find the strongest Argon2id parameters
 * whose derivation time stays within a configurable target window
 * (default 0.8–2.0 seconds). This ensures that key derivation is as
 * expensive as the device can comfortably handle, maximizing resistance
 * to brute-force / dictionary attacks while keeping user-perceived
 * latency acceptable.
 *
 * The calibration strategy:
 * 1. Start from baseline parameters (64 MiB, 3 iterations, 4 threads).
 * 2. Double `memorySize` until derivation exceeds the target maximum.
 * 3. Binary-search between the last "fast" and first "slow" memory sizes
 *    to land inside the target window.
 *
 * A dummy password and salt are used during calibration — no real
 * secrets are involved.
 */

import { argon2id } from 'hash-wasm'
import type { Argon2CalibrationService, CalibrationResult, Argon2Params } from './types'

/** Target derivation time range in milliseconds. */
const TARGET_MIN_MS = 800
const TARGET_MAX_MS = 2000

/** Maximum memory the calibration will ever try (512 MiB in KiB). */
const MAX_MEMORY_KIB = 512 * 1024

/** Minimum granularity for the binary-search step (1 MiB in KiB). */
const BINARY_SEARCH_PRECISION_KIB = 1024

/** Baseline parameters used as the starting point for calibration. */
export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  iterations: 3,
  memorySize: 64 * 1024, // 64 MiB in KiB
  parallelism: 4,
  hashLength: 32,
}

/** Dummy values used exclusively during calibration benchmarks. */
const CALIBRATION_PASSWORD = 'calibration-benchmark'
const CALIBRATION_SALT = new Uint8Array(16) // all-zero salt, fine for timing

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

export const argon2CalibrationService: Argon2CalibrationService = {
  /** @inheritdoc */
  async calibrate(): Promise<CalibrationResult> {
    // Phase 1 — exponential doubling of memorySize until we exceed the target
    let lastFastMemory = DEFAULT_ARGON2_PARAMS.memorySize
    let firstSlowMemory: number | null = null
    let lastDuration = 0

    let memory = DEFAULT_ARGON2_PARAMS.memorySize
    while (memory <= MAX_MEMORY_KIB) {
      const params: Argon2Params = { ...DEFAULT_ARGON2_PARAMS, memorySize: memory }
      const duration = await benchmark(params)

      if (duration >= TARGET_MIN_MS && duration <= TARGET_MAX_MS) {
        // Already in the sweet spot — return immediately
        return { params, durationMs: Math.round(duration) }
      }

      if (duration < TARGET_MIN_MS) {
        lastFastMemory = memory
        lastDuration = duration
      } else {
        // duration > TARGET_MAX_MS
        firstSlowMemory = memory
        break
      }

      memory *= 2
    }

    // If we hit the cap without exceeding the target, return the cap
    if (firstSlowMemory === null) {
      const capParams: Argon2Params = { ...DEFAULT_ARGON2_PARAMS, memorySize: lastFastMemory }
      return { params: capParams, durationMs: Math.round(lastDuration) }
    }

    // Phase 2 — binary search between lastFastMemory and firstSlowMemory
    let lo = lastFastMemory
    let hi = firstSlowMemory
    let bestResult: CalibrationResult = {
      params: { ...DEFAULT_ARGON2_PARAMS, memorySize: lo },
      durationMs: Math.round(lastDuration),
    }

    while (hi - lo > BINARY_SEARCH_PRECISION_KIB) {
      const mid = Math.floor((lo + hi) / 2)
      const params: Argon2Params = { ...DEFAULT_ARGON2_PARAMS, memorySize: mid }
      const duration = await benchmark(params)

      if (duration >= TARGET_MIN_MS && duration <= TARGET_MAX_MS) {
        // In the sweet spot — return immediately
        return { params, durationMs: Math.round(duration) }
      }

      if (duration < TARGET_MIN_MS) {
        lo = mid
        bestResult = { params, durationMs: Math.round(duration) }
      } else {
        hi = mid
      }
    }

    return bestResult
  },
}
