// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

const mockFetchUserData = vi.fn()
const mockSaveUserData = vi.fn()

vi.mock('../utils/supabase/userDataService', () => ({
  fetchUserData: (...args: unknown[]) => mockFetchUserData(...args),
  saveUserData: (...args: unknown[]) => mockSaveUserData(...args),
}))

const mockRunBenchmark = vi.fn()

vi.mock('../utils/crypto/argon2Calibration', () => ({
  argon2CalibrationService: {
    runBenchmark: (...args: unknown[]) => mockRunBenchmark(...args),
  },
}))

import { useSettingsStore } from './settingsStore'

const FAKE_PARAMS = { memorySize: 65536, iterations: 3, parallelism: 4, hashLength: 32 }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockSaveUserData.mockResolvedValue(undefined)
  mockFetchUserData.mockResolvedValue(null)
})

describe('settingsStore.loadSettings', () => {
  it('returns null and activates session when no stored settings', async () => {
    mockFetchUserData.mockResolvedValue(null)
    const store = useSettingsStore()
    const result = await store.loadSettings()
    expect(result).toBeNull()
  })

  it('parses stored settings and returns settings', async () => {
    const stored = JSON.stringify({ idleTimeoutMinutes: 10, argon2Params: FAKE_PARAMS })
    mockFetchUserData.mockResolvedValue(stored)

    const store = useSettingsStore()
    const result = await store.loadSettings()

    expect(result!.argon2Params).toEqual(FAKE_PARAMS)
    expect(result!.idleTimeoutMinutes).toBe(10)
  })

  it('merges stored settings with defaults', async () => {
    const stored = JSON.stringify({ idleTimeoutMinutes: 15 })
    mockFetchUserData.mockResolvedValue(stored)

    const store = useSettingsStore()
    await store.loadSettings()

    expect(store.settings.idleTimeoutMinutes).toBe(15)
    expect(store.settings.argon2Params).toBeUndefined()
  })
})

describe('settingsStore.updateSettings', () => {
  it('merges the patch into current settings', async () => {
    const store = useSettingsStore()
    await store.setIdleTimeoutMinutes(20)
    expect(store.settings.idleTimeoutMinutes).toBe(20)
  })

  it('persists the updated settings to DB', async () => {
    const store = useSettingsStore()
    await store.setIdleTimeoutMinutes(20)
    expect(mockSaveUserData).toHaveBeenCalledWith('settings', expect.stringContaining('"idleTimeoutMinutes":20'))
  })

  it('stores argon2Params when provided', async () => {
    const store = useSettingsStore()
    await store.setArgon2Params(FAKE_PARAMS)
    expect(store.settings.argon2Params).toEqual(FAKE_PARAMS)
  })
})

describe('settingsStore.resetSettings', () => {
  it('resets settings to defaults', async () => {
    const store = useSettingsStore()
    await store.setIdleTimeoutMinutes(99)
    store.resetSettings()
    expect(store.settings.idleTimeoutMinutes).toBe(5)
    expect(store.settings.argon2Params).toBeUndefined()
  })

  it('prevents the watcher from auto-saving after reset', async () => {
    const store = useSettingsStore()
    await store.loadSettings()
    store.resetSettings()
    vi.clearAllMocks()

    store.settings.idleTimeoutMinutes = 99
    await nextTick()
    await nextTick()

    expect(mockSaveUserData).not.toHaveBeenCalled()
  })
})

describe('settingsStore.runFullBenchmarks', () => {
  beforeEach(() => {
    mockRunBenchmark.mockResolvedValue({ params: FAKE_PARAMS, durationMs: 200 })
  })

  it('runs 4 benchmarks in Low mode', async () => {
    const store = useSettingsStore()
    await store.runFullBenchmarks('Low')
    expect(mockRunBenchmark).toHaveBeenCalledTimes(4)
  })

  it('runs 8 benchmarks in Medium mode', async () => {
    const store = useSettingsStore()
    await store.runFullBenchmarks('Medium')
    expect(mockRunBenchmark).toHaveBeenCalledTimes(8)
  })

  it('runs 15 benchmarks in High mode', async () => {
    const store = useSettingsStore()
    await store.runFullBenchmarks('High')
    expect(mockRunBenchmark).toHaveBeenCalledTimes(15)
  })

  it('populates benchmarkResults after completion', async () => {
    const store = useSettingsStore()
    await store.runFullBenchmarks('Low')
    expect(store.benchmarkResults).toHaveLength(4)
    expect(store.benchmarkResults[0].durationMs).toBe(200)
  })

  it('clears previous benchmarkResults before starting', async () => {
    const store = useSettingsStore()
    await store.runFullBenchmarks('Low')
    await store.runFullBenchmarks('Low')
    expect(store.benchmarkResults).toHaveLength(4)
  })
})
