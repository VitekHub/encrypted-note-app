import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { argon2CalibrationService, type Argon2Params, type CalibrationResult } from '../utils/crypto/argon2Calibration'
import { getUserData, setUserData } from '../utils/supabase/userDataService'

export interface AppSettings {
  idleTimeoutMinutes: number
  argon2Params?: Argon2Params
}

export type BenchmarkMode = 'Low' | 'Medium' | 'High'

const FULL_BENCHMARK_SETS: Argon2Params[] = [
  { memorySize: 64 * 1024, iterations: 3, parallelism: 4, hashLength: 32 },
  { memorySize: 64 * 1024, iterations: 10, parallelism: 4, hashLength: 32 },
  { memorySize: 128 * 1024, iterations: 1, parallelism: 4, hashLength: 32 },
  { memorySize: 128 * 1024, iterations: 3, parallelism: 4, hashLength: 32 },
  { memorySize: 128 * 1024, iterations: 8, parallelism: 4, hashLength: 32 },
  { memorySize: 256 * 1024, iterations: 1, parallelism: 4, hashLength: 32 },
  { memorySize: 256 * 1024, iterations: 3, parallelism: 4, hashLength: 32 },
  { memorySize: 256 * 1024, iterations: 6, parallelism: 4, hashLength: 32 },
  { memorySize: 512 * 1024, iterations: 1, parallelism: 4, hashLength: 32 },
  { memorySize: 512 * 1024, iterations: 3, parallelism: 4, hashLength: 32 },
  { memorySize: 512 * 1024, iterations: 5, parallelism: 4, hashLength: 32 },
  { memorySize: 1024 * 1024, iterations: 1, parallelism: 4, hashLength: 32 },
  { memorySize: 1024 * 1024, iterations: 3, parallelism: 4, hashLength: 32 },
  { memorySize: 256 * 1024, iterations: 3, parallelism: 1, hashLength: 32 },
  { memorySize: 256 * 1024, iterations: 3, parallelism: 8, hashLength: 32 },
]

const DATA_KEY = 'settings'

const defaultSettings: AppSettings = {
  idleTimeoutMinutes: 5,
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...defaultSettings })
  const benchmarkResults = ref<CalibrationResult[]>([])
  const _sessionActive = ref(false)

  watch(
    settings,
    async (newVal) => {
      if (!_sessionActive.value) return
      try {
        await setUserData(DATA_KEY, JSON.stringify(newVal))
      } catch (e) {
        console.error('Failed to auto-save settings', e) // eslint-disable-line no-console
      }
    },
    { deep: true }
  )

  async function loadSettings(): Promise<Argon2Params | null> {
    try {
      const stored = await getUserData(DATA_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as AppSettings
        settings.value = { ...defaultSettings, ...parsed }
        _sessionActive.value = true
        return parsed.argon2Params ?? null
      }
    } catch (e) {
      console.error('Failed to load settings from database', e) // eslint-disable-line no-console
    }
    _sessionActive.value = true
    return null
  }

  async function persistSettings(): Promise<void> {
    try {
      await setUserData(DATA_KEY, JSON.stringify(settings.value))
    } catch (e) {
      console.error('Failed to save settings to database', e) // eslint-disable-line no-console
    }
  }

  async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
    settings.value = { ...settings.value, ...patch }
    await persistSettings()
  }

  async function runFullBenchmarks(mode: BenchmarkMode): Promise<void> {
    let sets: Argon2Params[] = []

    switch (mode) {
      case 'Low':
        sets = [FULL_BENCHMARK_SETS[0], FULL_BENCHMARK_SETS[3], FULL_BENCHMARK_SETS[6], FULL_BENCHMARK_SETS[9]]
        break
      case 'Medium':
        sets = FULL_BENCHMARK_SETS.filter((_, i) => i % 2 === 0)
        break
      case 'High':
        sets = [...FULL_BENCHMARK_SETS]
        break
    }

    const wait = async () => await new Promise((resolve) => setTimeout(resolve, 0))

    benchmarkResults.value = []
    for (const params of sets) {
      const result = { params, durationMs: 0 }
      benchmarkResults.value.push(result)
      await wait()
      const res = await argon2CalibrationService.runBenchmark(params)
      benchmarkResults.value.pop()
      benchmarkResults.value.push({
        params,
        durationMs: res.durationMs,
      })
      await wait()
    }
  }

  function resetSettings(): void {
    _sessionActive.value = false
    settings.value = { ...defaultSettings }
  }

  return {
    settings,
    benchmarkResults,
    loadSettings,
    persistSettings,
    updateSettings,
    runFullBenchmarks,
    resetSettings,
  }
})
