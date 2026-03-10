/**
 * Result of an Argon2id calibration run.
 *
 * Contains the tuned parameters alongside the wall-clock time they took
 * on the current device, so callers can decide whether the result is
 * acceptable for their UX budget.
 */
export interface CalibrationResult {
  /** The Argon2id parameters measured during this calibration. */
  params: Argon2Params
  /** Wall-clock duration of the key-derivation in milliseconds. */
  durationMs: number
}

/**
 * Service that benchmarks Argon2id on the current device and returns
 * parameters whose derivation time falls within a target range.
 *
 * The calibration typically starts with conservative defaults and
 * progressively increases memory cost until the derivation time
 * reaches the target window (e.g. 0.8–2.0 s).
 *
 * @interface Argon2CalibrationService
 */
export interface Argon2CalibrationService {
  /**
   * Runs a series of Argon2id benchmarks and returns the strongest
   * parameters that keep derivation time within the target window.
   *
   * Calibration runs in three phases:
   * - **Phase 1 (exponential search)**: Starts from baseline (64 MiB) and doubles memorySize
   *   until time exceeds 2000 ms or max cap (512 MiB) is reached.
   *   - Returns early if any step lands inside 800–2000 ms (sweet spot found).
   *   - Returns max allowed memory if even 512 MiB is too fast (very powerful device).
   * - **Phase 2 (binary search)**: Only entered if Phase 1 overshot the target.
   *   Refines between the last acceptable and first too-slow memory value to maximize
   *   memorySize while staying as close as possible to the target time range.
   * - **Phase 3 (iteration tuning)**: If the found memory still results in a duration
   *   significantly below target, increases iterations to further strengthen the hash.
   *
   * If calibration fails or exceeds a 15s time budget, it falls back to safe defaults.
   *
  /**
   * Runs a series of Argon2id benchmarks and returns the strongest
   * parameters that keep derivation time within the target window.
   *
   * @returns {Promise<CalibrationResult>} The calibrated parameters and measured duration
   */
  calibrate(): Promise<CalibrationResult>
}

/**
 * Parameters for Argon2id key derivation. These values balance security and performance:
 * - iterations: Number of passes (higher increases computation time).
 * - memorySize: Memory usage in KiB (higher makes GPU/ASIC attacks harder).
 * - parallelism: Number of threads (typically 4 for modern browsers/Node).
 * - hashLength: Output hash length in bytes (32 = 256-bit key for AES-GCM).
 * Higher values increase security by making key derivation slower and more resource-intensive,
 * which protects against dictionary attacks, but also increases computation time for encryption/decryption.
 */
export interface Argon2Params {
  iterations: number
  memorySize: number
  parallelism: number
  hashLength: number
}
