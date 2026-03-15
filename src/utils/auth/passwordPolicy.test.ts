import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPasswordStrength, validatePassword } from './passwordPolicy'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('getPasswordStrength', () => {
  it('returns weak for empty string', () => {
    const result = getPasswordStrength('')
    expect(result.level).toBe('weak')
    expect(result.score).toBe(0)
  })

  it('returns weak for very short password', () => {
    const result = getPasswordStrength('abc')
    expect(result.level).toBe('weak')
  })

  it('returns fair for a password with length and multiple character classes', () => {
    const result = getPasswordStrength('abcdefghABC')
    expect(result.level).toBe('fair')
  })

  it('returns good for a longer password with more variety', () => {
    const result = getPasswordStrength('abcdefghABC1')
    expect(result.level).toBe('good')
  })

  it('returns strong for a password with all character classes and long length', () => {
    const result = getPasswordStrength('abcABC123!@#$%^&*')
    expect(result.level).toBe('strong')
    expect(result.score).toBe(4)
    expect(result.label).toBe('Strong')
  })

  it('awards length bonuses at 8, 12, and 16 chars', () => {
    const at8 = getPasswordStrength('aaaaaaaa')
    const at12 = getPasswordStrength('aaaaaaaaaaaa')
    const at16 = getPasswordStrength('aaaaaaaaaaaaaaaa')
    expect(at12.score).toBeGreaterThanOrEqual(at8.score)
    expect(at16.score).toBeGreaterThanOrEqual(at12.score)
  })

  it('awards separate points for uppercase, lowercase, digit, and special character', () => {
    const lower = getPasswordStrength('aaaaaaaa')
    const withUpper = getPasswordStrength('aaaaaaAA')
    const withDigit = getPasswordStrength('aaaaaaA1')
    const withSpecial = getPasswordStrength('aaaaaaA1!')
    expect(withUpper.score).toBeGreaterThanOrEqual(lower.score)
    expect(withDigit.score).toBeGreaterThanOrEqual(withUpper.score)
    expect(withSpecial.score).toBeGreaterThanOrEqual(withDigit.score)
  })
})

describe('validatePassword', () => {
  it('rejects passwords shorter than 8 characters without calling fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await validatePassword('abc')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('8 characters')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns valid for a password not found in HIBP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'AAAAABBBBBCCCCC:5\nDDDDDEEEEEFFFFF:2',
      })
    )

    const result = await validatePassword('ValidP@ssword99!')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('sends only the first 5 hash chars to the HIBP API', async () => {
    let capturedUrl = ''
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        capturedUrl = url
        return Promise.resolve({ ok: true, text: async () => '' })
      })
    )

    await validatePassword('ValidP@ssword99!')
    expect(capturedUrl).toMatch(/^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/)
  })

  it('returns an error when password is found in HIBP breach data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        const prefix = url.split('/').pop()!
        const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode('password'))
        const hashHex = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase()

        const suffix = hashHex.slice(5)
        const returnedPrefix = hashHex.slice(0, 5)

        if (returnedPrefix === prefix) {
          return { ok: true, text: async () => `${suffix}:9999999` }
        }
        return { ok: true, text: async () => '' }
      })
    )

    const result = await validatePassword('password')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('data breaches')
    expect(result.errors[0]).toContain('9')
  })

  it('passes validation silently when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const result = await validatePassword('ValidP@ssword99!')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('passes validation silently when HIBP API returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const result = await validatePassword('ValidP@ssword99!')
    expect(result.valid).toBe(true)
  })
})
