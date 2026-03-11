import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { argon2CalibrationService, FALLBACK_ARGON2_PARAMS } from './argon2CalibrationService'
import { argon2id } from 'hash-wasm'

// Increase timeout because some paths do many sequential awaits
vi.setConfig({ testTimeout: 10_000 })

vi.mock('hash-wasm', () => ({
  argon2id: vi.fn(),
}))

describe('argon2CalibrationService.calibrate()', () => {
  let mockTime = 10000

  beforeEach(() => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 4 })
    vi.spyOn(performance, 'now').mockImplementation(() => mockTime)
    mockTime = 10000

    // Reset mock calls
    vi.mocked(argon2id).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // Helper to simulate argon2id timing
  function mockBenchmark(durationMs: number) {
    vi.mocked(argon2id).mockImplementationOnce(async () => {
      mockTime += durationMs
      return 'deadbeef'.repeat(8) // dummy hex
    })
  }

  it('returns fallback when calibration times out early', async () => {
    // Make every call take almost the whole budget → timeout in phase 1
    mockBenchmark(14000)
    mockBenchmark(14000) // second call would exceed

    const result = await argon2CalibrationService.calibrate()

    expect(result.params).toEqual(FALLBACK_ARGON2_PARAMS)
    expect(result.durationMs).toBe(0)
  })

  it('finds good parameters in phase 1 (lucky device)', async () => {
    // 64 MiB → 650 ms  (too fast)
    // 128 MiB → 920 ms  → perfect range
    mockBenchmark(650)
    mockBenchmark(920)

    const result = await argon2CalibrationService.calibrate()

    expect(result.params.memorySize).toBe(128 * 1024)
    expect(result.params.iterations).toBe(3) // no tuning needed
    expect(result.durationMs).toBe(920)
    expect(result.params.parallelism).toBe(4)
  })

  it('performs binary search in phase 2 and lands in range', async () => {
    // Phase 1 doubling
    mockBenchmark(280) // 64 MiB   < 800
    mockBenchmark(540) // 128 MiB  < 800
    mockBenchmark(760) // 256 MiB  < 800   → lo = 256
    mockBenchmark(2450) // 512 MiB  > 2000  → hi = 512, first slow

    // Binary search (lo=256 @760 ms, hi=512 @2450 ms)

    // mid ≈ 384 MiB → too slow → hi = 384
    mockBenchmark(2280) // 384 MiB > 2000

    // mid ≈ 320 MiB → good range → should return immediately
    mockBenchmark(1420) // 320 MiB  ∈ [800,2000]

    const result = await argon2CalibrationService.calibrate()

    expect(result.params.memorySize).toBe(320 * 1024)
    expect(result.params.iterations).toBe(3)
    expect(result.durationMs).toBe(1420)
  })

  it('tunes iterations upward when memory maxed but still fast', async () => {
    // Very fast device: even 512 MiB @ iter=3 is only 480 ms
    // Should climb iterations
    mockBenchmark(120) // 64
    mockBenchmark(220) // 128
    mockBenchmark(380) // 256
    mockBenchmark(480) // 512  ← max memory, still <800

    // Now tune iterations (phase 3)
    // iter=4 → 820 ms  (good!)
    mockBenchmark(820)

    const result = await argon2CalibrationService.calibrate()

    expect(result.params.memorySize).toBe(512 * 1024)
    expect(result.params.iterations).toBe(4)
    expect(result.durationMs).toBe(820)
  })

  it('stops iteration tuning if next step would overshoot too much', async () => {
    // Force it to reach max memory without early accept
    mockBenchmark(180) // 64
    mockBenchmark(340) // 128
    mockBenchmark(620) // 256
    mockBenchmark(720) // 512 @ iter=3  < EARLY_ACCEPT_BELOW=736 → continues to phase 3

    // Phase 3 – tune iterations
    mockBenchmark(1480) // iter=4 @512 MiB → good range → accept & stop

    // We should NOT see iter=5 because we're already in range

    const result = await argon2CalibrationService.calibrate()

    expect(result.params.memorySize).toBe(512 * 1024)
    expect(result.params.iterations).toBe(4)
    expect(result.durationMs).toBe(1480)
  })

  it('early-accepts when already very close after reaching max memory', async () => {
    mockBenchmark(200) // 64 MiB
    mockBenchmark(300) // 128 MiB
    mockBenchmark(450) // 256 MiB
    mockBenchmark(750) // 512 MiB (Max memory reached, but < 800 ms)

    // Phase 3 — tuneIterations should early-accept 750 because it's > EARLY_ACCEPT_BELOW (736)
    const result = await argon2CalibrationService.calibrate()

    expect(result.params.memorySize).toBe(512 * 1024)
    expect(result.params.iterations).toBe(3)
    expect(result.durationMs).toBe(750)
  })

  it('uses correct parallelism from hardwareConcurrency', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 6 })

    // Just one fast call to see parallelism=6
    mockBenchmark(900)

    const result = await argon2CalibrationService.calibrate()

    expect(result.params.parallelism).toBe(6)
  })

  it('clamps parallelism between 1 and 8', async () => {
    // Test upper bound
    vi.stubGlobal('navigator', { hardwareConcurrency: 16 })
    mockBenchmark(900)
    let result = await argon2CalibrationService.calibrate()
    expect(result.params.parallelism).toBe(8)

    // Test lower bound
    vi.stubGlobal('navigator', { hardwareConcurrency: 0 }) // fallback to 4, but min 1
    mockBenchmark(900)
    result = await argon2CalibrationService.calibrate()
    expect(result.params.parallelism).toBeGreaterThanOrEqual(1)
  })

  it('falls back when binary search cannot find sweet spot in time', async () => {
    // Phase 1 quick
    mockBenchmark(180) // 64
    mockBenchmark(350) // 128
    mockBenchmark(680) // 256
    mockBenchmark(2200) // 512 → first slow

    // Now burn time in binary search (lo=256 @680, hi=512 @2200)
    // Use values outside the [800, 2000] range to avoid early acceptance
    for (let i = 0; i < 10; i++) {
      mockBenchmark(2100)
    }

    const result = await argon2CalibrationService.calibrate()

    expect(result.params).toEqual(FALLBACK_ARGON2_PARAMS)
    expect(result.durationMs).toBe(0)
  })
})
