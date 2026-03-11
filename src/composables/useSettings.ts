import { ref, watch } from 'vue'
import { argon2CalibrationService, type Argon2Params, type CalibrationResult } from '../utils/crypto/argon2Calibration'

export interface AppSettings {
  idleTimeoutMinutes: number
  argon2Params?: Argon2Params
}

export type BenchmarkMode = 'Low' | 'Medium' | 'High'

/** Predefined benchmark configurations for manual testing/analysis. */
const FULL_BENCHMARK_SETS: Argon2Params[] = [
  { memorySize: 64 * 1024, iterations: 3, parallelism: 4, hashLength: 32 }, // 1. Baseline
  { memorySize: 64 * 1024, iterations: 10, parallelism: 4, hashLength: 32 }, // 2. Iter-heavy small
  { memorySize: 128 * 1024, iterations: 1, parallelism: 4, hashLength: 32 }, // 3. Mem-skew tiny
  { memorySize: 128 * 1024, iterations: 3, parallelism: 4, hashLength: 32 }, // 4. 128MB normal
  { memorySize: 128 * 1024, iterations: 8, parallelism: 4, hashLength: 32 }, // 5. 128MB heavy
  { memorySize: 256 * 1024, iterations: 1, parallelism: 4, hashLength: 32 }, // 6. 256MB tiny
  { memorySize: 256 * 1024, iterations: 3, parallelism: 4, hashLength: 32 }, // 7. 256MB normal
  { memorySize: 256 * 1024, iterations: 6, parallelism: 4, hashLength: 32 }, // 8. 256MB mid
  { memorySize: 512 * 1024, iterations: 1, parallelism: 4, hashLength: 32 }, // 9. 512MB tiny
  { memorySize: 512 * 1024, iterations: 3, parallelism: 4, hashLength: 32 }, // 10. 512MB normal
  { memorySize: 512 * 1024, iterations: 5, parallelism: 4, hashLength: 32 }, // 11. 512MB mid
  { memorySize: 1024 * 1024, iterations: 1, parallelism: 4, hashLength: 32 }, // 12. 1GB tiny
  { memorySize: 1024 * 1024, iterations: 3, parallelism: 4, hashLength: 32 }, // 13. 1GB normal
  { memorySize: 256 * 1024, iterations: 3, parallelism: 1, hashLength: 32 }, // 14. Single core
  { memorySize: 256 * 1024, iterations: 3, parallelism: 8, hashLength: 32 }, // 15. Multi core
]

const SETTINGS_KEY = 'app-settings'

const defaultSettings: AppSettings = {
  idleTimeoutMinutes: 5, // 5 minutes default
}

let initialSettings = { ...defaultSettings }
try {
  const stored = localStorage.getItem(SETTINGS_KEY)
  if (stored) {
    initialSettings = { ...defaultSettings, ...JSON.parse(stored) }
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('Failed to parse app settings from localStorage', e)
}

const settings = ref<AppSettings>(initialSettings)
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

  // Give the browser a moment to paint the new row
  const wait = async () => await new Promise((resolve) => setTimeout(resolve, 0))

  benchmarkResults.value = []
  for (const params of sets) {
    const result = { params, durationMs: 0 }
    benchmarkResults.value.push(result)
    await wait()
    const res = await argon2CalibrationService.runBenchmark(params)
    result.durationMs = res.durationMs
    await wait()
  }
}

function resetSettings() {
  settings.value = { ...defaultSettings }
}

export function useSettings() {
  return {
    settings,
    benchmarkResults,
    runFullBenchmarks,
    resetSettings,
  }
}
