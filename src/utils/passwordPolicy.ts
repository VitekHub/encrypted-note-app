const MIN_PASSWORD_LENGTH = 8

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validates a password against the policy rules.
 * Checks minimum length and whether the password has appeared in known data breaches
 * via the HaveIBeenPwned API (k-anonymity model — only the first 5 hex chars of the
 * SHA-1 hash are sent to the server, so the plaintext password never leaves the client).
 *
 * @param password - The plaintext password to validate.
 * @returns A result object with a `valid` flag and an array of `errors` (empty if valid).
 */
export async function validatePassword(password: string): Promise<PasswordValidationResult> {
  const errors: string[] = []

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }

  if (errors.length === 0) {
    const pwned = await checkPwnedPassword(password)
    if (pwned) {
      const formatted = Number(pwned).toLocaleString('en-US', { useGrouping: true }).replace(/,/g, ' ')
      errors.push(`This password has appeared in known data breaches (${formatted} times). Please choose a different password.`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Checks whether a password appears in the HaveIBeenPwned breach database using the
 * k-anonymity range API. Only the first 5 characters of the SHA-1 hash are transmitted,
 * so the server never learns the full hash or the original password.
 *
 * SHA-1 is intentionally used here because it is the hash algorithm required by the
 * HIBP range API. It is NOT used for any security-sensitive purpose (e.g. key derivation
 * or authentication) — it merely identifies a bucket of candidate hashes. The privacy
 * guarantee comes from the k-anonymity model, not from SHA-1's collision resistance.
 *
 * @param password - The plaintext password to check.
 * @returns The number of times the password appeared in known breaches, or `0` if not found.
 *   Errors are silently swallowed so that a network failure does not block the user.
 */
async function checkPwnedPassword(password: string): Promise<number> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password))
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()

    const prefix = hashHex.slice(0, 5)
    const suffix = hashHex.slice(5)

    // also returns number of times a specific password has been found in data breaches
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`,{ headers: { 'Add-Padding': 'true' } })

    if (!res.ok) return 0

    const text = await res.text()
    const lines = text.split('\n')

    for (const line of lines) {
      const [hashSuffix, count] = line.split(':')
      if (hashSuffix.trim().toUpperCase() === suffix) {
        return parseInt(count, 10)
      }
    }

    return 0
  } catch {
    return 0
  }
}
