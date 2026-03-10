import { describe, it, expect, vi } from 'vitest'
import { argon2CalibrationService } from './argon2CalibrationService'
import { argon2id } from 'hash-wasm'
import type { Argon2Params } from './types'

// Mock hash-wasm to control the "timing" of argon2id
vi.mock('hash-wasm', () => ({
  argon2id: vi.fn(),
}))

describe('argon2CalibrationService.calibrate', () => {
  it('returns parameters and duration when calibration is successful', async () => {
    // Simulate a device where 128MB takes ~1.2s
    let callCount = 0
    vi.mocked(argon2id).mockImplementation(async () => {
      callCount++
      // First call (64MB) -> fast (e.g. 400ms)
      // Second call (128MB) -> target (e.g. 1200ms)
      if (callCount === 1) {
        await new Promise((r) => setTimeout(r, 10)) // simulate some work
        return 'hash'
      }
      // Simulate 1200ms by delaying the mock
      // However, the benchmark uses performance.now() which we can't easily control via setTimeout alone in a mock
      // unless we also mock performance.now()
      return 'hash'
    })

    // To properly test the LOGIC of doubling/binary search, we'd need to mock performance.now()
    const nowSpy = vi.spyOn(performance, 'now')
    let mockTime = 10000
    nowSpy.mockImplementation(() => {
      const current = mockTime
      return current
    })

    // Mock sequence:
    // 1. benchmark(64MB) -> returns 400ms
    // 2. benchmark(128MB) -> returns 1200ms (TARGET!)

    vi.mocked(argon2id).mockImplementation(async () => {
      // Sequence of benchmark calls:
      // Call 1: memory=64MB. We want duration < 800ms. e.g. 400ms.
      // So performance.now() should move from T to T+400.
      mockTime += 400
      return 'hash'
    })

    // Reset mockTime for the actual run
    mockTime = 10000

    // First call (64MB) -> 400ms
    // Second call (128MB) -> 1200ms
    // we need to set the mockTime INCREMENTS carefully

    let benchmarkStep = 0
    vi.mocked(argon2id).mockImplementation(async () => {
      benchmarkStep++
      if (benchmarkStep === 1) {
        mockTime += 400 // 64MB -> 400ms
      } else if (benchmarkStep === 2) {
        mockTime += 1200 // 128MB -> 1200ms
      }
      return 'hash'
    })

    const result = await argon2CalibrationService.calibrate()

    expect(result.params.memorySize).toBe(128 * 1024)
    expect(result.durationMs).toBe(1200)
    expect(benchmarkStep).toBe(2) // 64MB was too fast, 128MB hit the spot

    nowSpy.mockRestore()
  })

  it('performs binary search if doubling jumps over the target', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    let mockTime = 10000
    nowSpy.mockImplementation(() => mockTime)

    // Sequence:
    // 1. 64MB -> 400ms (too fast)
    // 2. 128MB -> 3000ms (too slow!) -> starts binary search between 64 and 128
    // 3. 96MB (mid) -> 1500ms (TARGET!)

    vi.mocked(argon2id).mockImplementation(async (params: Argon2Params) => {
      if (params.memorySize === 64 * 1024) mockTime += 400
      else if (params.memorySize === 128 * 1024) mockTime += 3000
      else if (params.memorySize === 96 * 1024) mockTime += 1500
      return 'hash'
    })

    const result = await argon2CalibrationService.calibrate()

    expect(result.params.memorySize).toBe(96 * 1024)
    expect(result.durationMs).toBe(1500)

    nowSpy.mockRestore()
  })

  it('caps at MAX_MEMORY_KIB if target is never reached', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    let mockTime = 10000
    nowSpy.mockImplementation(() => mockTime)

    // Everything is super fast (e.g. 10ms) even at 512MB
    vi.mocked(argon2id).mockImplementation(async () => {
      mockTime += 10
      return 'hash'
    })

    const result = await argon2CalibrationService.calibrate()

    expect(result.params.memorySize).toBe(512 * 1024) // Cap
    expect(result.durationMs).toBe(10)

    nowSpy.mockRestore()
  })
})
