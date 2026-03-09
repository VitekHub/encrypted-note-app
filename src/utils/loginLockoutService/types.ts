/**
 * Service provides operations for managing user login attempts and enforcing
 * lockout periods after consecutive failed attempts to prevent brute-force attacks.
 *
 * **Security Model:**
 * - Implements an exponential backoff strategy for lockouts
 * - State is persisted across sessions using secure storage
 * - Lockout durations increase with each successive failure
 */
export interface LoginLockoutService {
  /**
   * Checks if the user is currently locked out due to too many failed attempts.
   *
   * @returns {Promise<void>} A promise that resolves if the user is allowed to attempt login
   * @throws {LockoutError} If the user is currently locked out
   */
  checkLockout(): Promise<void>

  /**
   * Records a failed login attempt.
   *
   * This function:
   * - Increments the failed attempt counter
   * - Calculates the next lockout duration based on the backoff strategy
   * - Persists the new lockout timestamp
   *
   * @returns {Promise<void>} A promise that resolves when the attempt and lockout duration have been recorded
   */
  recordFailedAttempt(): Promise<void>

  /**
   * Resets the failed attempt counter and clears any active lockout periods.
   *
   * This function should be called immediately upon a successful login sequence.
   *
   * @returns {Promise<void>} A promise that resolves when the reset is complete
   */
  reset(): Promise<void>
}
