import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { argon2CalibrationService, type Argon2Params, type CalibrationResult } from '../utils/crypto/argon2Calibration'

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

const SETTINGS_KEY = 'app-settings'

const defaultSettings: AppSettings = {
  idleTimeoutMinutes: 5,
}

export const useSettingsStore = defineStore('settings', () => {
  function loadInitialSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse app settings from localStorage', e)
    }
    return { ...defaultSettings }
  }

  const settings = ref<AppSettings>(loadInitialSettings())
  const benchmarkResults = ref<CalibrationResult[]>([])

  watch(
    settings,
    (newVal) => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newVal))
    },
    { deep: true }
  )

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
    settings.value = { ...defaultSettings }
  }

  return {
    settings,
    benchmarkResults,
    runFullBenchmarks,
    resetSettings,
  }
})
