<template>
  <div class="section-card">
    <h3 class="section-heading">Key Derivation Strength (Argon2id)</h3>
    <p class="muted-text mb-3">
      Argon2id protects your password against brute-force attacks. Higher memory and iteration values make cracking
      attempts much harder but increase login time.
    </p>

    <div v-if="settings.argon2Params" class="params-display">
      <div class="param-item">
        <span class="param-label">Memory:</span>
        <span class="param-value">{{ Math.round(settings.argon2Params.memorySize / 1024) }} MiB</span>
      </div>
      <div class="param-item">
        <span class="param-label">Iterations:</span>
        <span class="param-value">{{ settings.argon2Params.iterations }}</span>
      </div>
      <div class="param-item">
        <span class="param-label">Parallelism:</span>
        <span class="param-value">{{ settings.argon2Params.parallelism }}</span>
      </div>
    </div>
    <p v-else class="muted-text info-text">Using default standard security parameters.</p>

    <div class="flex gap-3 mt-2">
      <BaseButton variant="secondary" :loading="calibrating" :disabled="applyingCalibration" @click="runCalibration">
        {{ calibrating ? 'Calibrating...' : 'Auto-calibrate for this device' }}
      </BaseButton>
    </div>

    <CalibrationResultPanel
      v-if="suggestedCryptoParams"
      :result="suggestedCryptoParams"
      :applying="applyingCalibration"
      @apply="applyDialogOpen = true"
    />

    <div class="mt-6">
      <hr class="divider" />
      <h4 class="benchmark-title">Manual Benchmark Tool</h4>
      <p class="muted-text mb-3">
        Run predefined configurations to see how your device performs. Bypasses target time constraints.
      </p>
      <div class="flex gap-3 items-center mb-4">
        <div class="flex-1 max-w-[160px]">
          <BaseSelect v-model="benchmarkMode" :options="benchmarkModes" />
        </div>
        <BaseButton variant="secondary" :loading="benchmarking" @click="handleRunFullBenchmark">
          {{ benchmarking ? 'Benchmarking...' : 'Run Benchmarks' }}
        </BaseButton>
      </div>

      <BenchmarkResultsTable v-if="benchmarkResults.length > 0" :results="benchmarkResults" />
    </div>

    <BaseDialog
      v-if="applyDialogOpen"
      title="Strengthen Key Wrapper"
      description="Applying these parameters will re-encrypt your RSA private key. Enter your current password to proceed."
      @close="closeApplyDialog"
    >
      <form @submit.prevent="handleApplyCalibration">
        <BaseInput
          v-model="calibrationPassword"
          label="Current Password"
          type="password"
          :required="true"
          input-ref="calib-password-input"
        />
        <p v-if="applyError" class="error-text mt-2">{{ applyError }}</p>
      </form>
      <template #actions>
        <BaseButton variant="secondary" type="button" @click="closeApplyDialog">Cancel</BaseButton>
        <BaseButton variant="primary" :loading="applyingCalibration" @click="handleApplyCalibration">
          Apply & Re-encrypt
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { cryptoService, type CalibrationResult } from '../../utils/crypto/cryptoService'
import { useNotificationStore } from '../../stores/notificationStore'
import { useSettingsStore, type BenchmarkMode } from '../../stores/settingsStore'
import BaseDialog from '../ui/BaseDialog.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseSelect from '../ui/BaseSelect.vue'
import BenchmarkResultsTable from './BenchmarkResultsTable.vue'
import CalibrationResultPanel from './CalibrationResult.vue'

const { showNotification } = useNotificationStore()
const settingsStore = useSettingsStore()
const { settings, benchmarkResults } = storeToRefs(settingsStore)
const { runFullBenchmarks } = settingsStore

const calibrating = ref(false)
const benchmarking = ref(false)
const applyingCalibration = ref(false)
const applyDialogOpen = ref(false)
const applyError = ref('')
const calibrationPassword = ref('')
const benchmarkMode = ref<BenchmarkMode>('Low')
const suggestedCryptoParams = ref<CalibrationResult | null>(null)

const benchmarkModes: { value: BenchmarkMode; label: string }[] = [
  { value: 'Low', label: 'Low (4 tests)' },
  { value: 'Medium', label: 'Medium (8 tests)' },
  { value: 'High', label: 'High (15 tests)' },
]

watch(applyDialogOpen, async (val) => {
  if (val) {
    await nextTick()
    document.getElementById('current-password')?.focus()
  }
})

async function runCalibration() {
  calibrating.value = true
  await new Promise((resolve) => setTimeout(resolve, 0))
  try {
    suggestedCryptoParams.value = await cryptoService.calibrateToDeviceCapability()
    showNotification('Calibration complete!', 'success')
  } finally {
    calibrating.value = false
  }
}

async function handleRunFullBenchmark() {
  benchmarking.value = true
  try {
    await runFullBenchmarks(benchmarkMode.value)
    showNotification(`Completed ${benchmarkResults.value.length} benchmarks`, 'success')
  } finally {
    benchmarking.value = false
  }
}

function closeApplyDialog() {
  applyDialogOpen.value = false
  applyError.value = ''
  calibrationPassword.value = ''
}

async function handleApplyCalibration() {
  if (!suggestedCryptoParams.value) return
  applyingCalibration.value = true
  applyError.value = ''
  try {
    await cryptoService.updateParams(calibrationPassword.value, suggestedCryptoParams.value.params)
    settings.value.argon2Params = suggestedCryptoParams.value.params
    showNotification('Security parameters strengthened successfully!', 'success')
    suggestedCryptoParams.value = null
    closeApplyDialog()
  } catch (err) {
    applyError.value = err instanceof Error && err.message ? err.message : 'Failed to apply calibration'
  } finally {
    applyingCalibration.value = false
  }
}
</script>

<style scoped>
@reference "tailwindcss";
.params-display {
  @apply grid gap-3 mb-4 p-3 rounded-md;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  background: var(--color-bg);
  border: 1px solid var(--color-border);
}

.param-item {
  @apply flex flex-col gap-1;
}

.param-label {
  @apply text-xs font-medium;
  color: var(--color-muted);
}

.param-value {
  @apply text-sm font-semibold;
  color: var(--color-text);
}

.info-text {
  @apply italic;
  font-size: 0.8125rem;
}

.divider {
  @apply border-0 mb-6;
  border-top: 1px solid var(--color-border);
}

.benchmark-title {
  @apply text-sm font-semibold mb-2;
  color: var(--color-heading);
}
</style>
