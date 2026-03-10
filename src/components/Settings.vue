<template>
  <div class="settings">
    <h2>Security Settings</h2>

    <div class="setting-section">
      <h3>Auto-Lock</h3>
      <p>Automatically lock your session and clear memory after a period of inactivity.</p>
      <div class="select-wrapper">
        <select v-model="settings.idleTimeoutMinutes" class="timeout-select">
          <option v-for="option in timeoutOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <div class="setting-section">
      <h3>Password Management</h3>
      <p>Change your master password. This re-encrypts your RSA private key with the new password.</p>
      <button class="btn-primary" @click="openChangePasswordDialog">Change Password</button>
    </div>

    <div class="setting-section suspicious">
      <h3>Suspicious Account Activity?</h3>
      <p class="warning">
        Recommended if your password was leaked, device was stolen, or suspicious activity detected.
      </p>
      <p>This generates a new RSA key pair and re-wraps your master key. Your data remains accessible.</p>
      <button class="btn-danger" @click="openRotateRsaDialog">Perform Security Key Rotation</button>
    </div>

    <div class="setting-section">
      <h3>Key Derivation Strength (Argon2id)</h3>
      <p>
        Argon2id protects your password against brute-force attacks. Higher memory and iteration values make cracking
        attempts much harder but increase login time.
      </p>
      <div v-if="settings.argon2Params" class="params-display">
        <div class="param-item">
          <span class="label">Memory:</span>
          <span class="value">{{ Math.round(settings.argon2Params.memorySize / 1024) }} MiB</span>
        </div>
        <div class="param-item">
          <span class="label">Iterations:</span>
          <span class="value">{{ settings.argon2Params.iterations }}</span>
        </div>
        <div class="param-item">
          <span class="label">Parallelism:</span>
          <span class="value">{{ settings.argon2Params.parallelism }}</span>
        </div>
      </div>
      <p v-else class="info-text">Using default standard security parameters.</p>

      <div class="actions">
        <button class="btn-secondary" :disabled="calibrating || applyingCalibration" @click="runCalibration">
          <span v-if="calibrating" class="spinner-icon"></span>
          {{ calibrating ? 'Calibrating...' : 'Auto-calibrate for this device' }}
        </button>
      </div>

      <div v-if="suggestedCryptoParams" class="calibration-result">
        <p><strong>Calibration Result:</strong></p>
        <p>Target time (0.8-2s) met on this device with:</p>
        <ul>
          <li>Memory: {{ Math.round(suggestedCryptoParams.params.memorySize / 1024) }} MiB</li>
          <li>Iterations: {{ suggestedCryptoParams.params.iterations }}</li>
          <li>Parallelism: {{ suggestedCryptoParams.params.parallelism }}</li>
          <li>Estimated time: {{ (suggestedCryptoParams.durationMs / 1000).toFixed(2) }}s</li>
        </ul>
        <button class="btn-primary btn-sm" :disabled="applyingCalibration" @click="openApplyCalibrationDialog">
          Apply & Strengthen Key Wrapper
        </button>
      </div>

      <div class="benchmark-tool">
        <hr />
        <h4>Manual Benchmark Tool</h4>
        <p>Run predefined configurations to see how your device performs. Bypasses target time constraints.</p>
        <div class="benchmark-controls">
          <select v-model="benchmarkMode" class="timeout-select">
            <option v-for="mode in benchmarkModes" :key="mode.value" :value="mode.value">
              {{ mode.label }}
            </option>
          </select>
          <button class="btn-secondary" :disabled="benchmarking" @click="handleRunFullBenchmark">
            <span v-if="benchmarking" class="spinner-icon"></span>
            {{ benchmarking ? 'Benchmarking...' : 'Run Benchmarks' }}
          </button>
        </div>

        <div v-if="benchmarkResults.length > 0" class="benchmark-results">
          <table>
            <thead>
              <tr>
                <th>Memory</th>
                <th>Iter</th>
                <th>Parallel</th>
                <th>Time (ms)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(res, i) in benchmarkResults" :key="i">
                <td>{{ Math.round(res.params.memorySize / 1024) }} MiB</td>
                <td>{{ res.params.iterations }}</td>
                <td>{{ res.params.parallelism }}</td>
                <td :class="{ 'slow-result': res.durationMs > 2000 }">
                  <span v-if="res.durationMs === 0" class="spinner-icon"></span>
                  <span v-else-if="res.durationMs === -1" class="error">Out of Mem.</span>
                  <span v-else>{{ res.durationMs }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Apply Calibration Dialog -->
    <div v-if="showApplyCalibration" class="dialog-overlay" @click="closeDialogs">
      <div class="dialog" @click.stop>
        <h3>Strengthen Key Wrapper</h3>
        <p>Applying these parameters will re-encrypt your RSA private key. Enter your current password to proceed.</p>
        <form @submit.prevent="handleApplyCalibration">
          <label>
            Current Password:
            <input ref="calibrationPasswordInput" v-model="calibrationPassword" type="password" required />
          </label>
          <div class="dialog-actions">
            <button type="button" @click="closeDialogs">Cancel</button>
            <button type="submit" :disabled="applyingCalibration">Apply & Re-encrypt</button>
          </div>
        </form>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
    </div>

    <!-- Change Password Dialog -->
    <div v-if="showChangePassword" class="dialog-overlay" @click="closeDialogs">
      <div class="dialog" @click.stop>
        <h3>Change Password</h3>
        <form @submit.prevent="handleChangePassword">
          <label>
            Current Password:
            <input ref="oldPasswordInput" v-model="oldPassword" type="password" required />
          </label>
          <label>
            New Password:
            <input v-model="newPassword" type="password" required />
          </label>
          <label>
            Confirm New Password:
            <input v-model="confirmPassword" type="password" required />
          </label>
          <div class="dialog-actions">
            <button type="button" @click="closeDialogs">Cancel</button>
            <button type="submit" :disabled="loading || newPassword !== confirmPassword">Change</button>
          </div>
        </form>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
    </div>

    <!-- Rotate RSA Dialog -->
    <div v-if="showRotateRsa" class="dialog-overlay" @click="closeDialogs">
      <div class="dialog" @click.stop>
        <h3>Rotate RSA Keys</h3>
        <p>Enter your current password to proceed with key rotation.</p>
        <form @submit.prevent="handleRotateRsa">
          <label>
            Password:
            <input ref="rsaPasswordInput" v-model="rsaPassword" type="password" required />
          </label>
          <div class="dialog-actions">
            <button type="button" @click="closeDialogs">Cancel</button>
            <button type="submit" :disabled="loading">Rotate Keys</button>
          </div>
        </form>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { cryptoService, type CalibrationResult } from '../utils/crypto/cryptoService'
import { useNotification } from '../composables/useNotification'
import { useSettings, type BenchmarkMode } from '../composables/useSettings'

const emit = defineEmits<{
  close: []
}>()

const { showNotification } = useNotification()
const { settings, benchmarkResults, runFullBenchmarks } = useSettings()

const timeoutOptions = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 0, label: 'Never' },
]

const benchmarkModes: { value: BenchmarkMode; label: string }[] = [
  { value: 'Low', label: 'Low (4 tests)' },
  { value: 'Medium', label: 'Medium (8 tests)' },
  { value: 'High', label: 'High (15 tests)' },
]

const showChangePassword = ref(false)
const showRotateRsa = ref(false)
const showApplyCalibration = ref(false)
const loading = ref(false)
const calibrating = ref(false)
const benchmarking = ref(false)
const applyingCalibration = ref(false)
const error = ref('')

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const rsaPassword = ref('')
const calibrationPassword = ref('')
const benchmarkMode = ref<BenchmarkMode>('Low')

const suggestedCryptoParams = ref<CalibrationResult | null>(null)

const oldPasswordInput = ref<HTMLInputElement>()
const rsaPasswordInput = ref<HTMLInputElement>()
const calibrationPasswordInput = ref<HTMLInputElement>()

function closeDialogs() {
  showChangePassword.value = false
  showRotateRsa.value = false
  showApplyCalibration.value = false
  loading.value = false
  error.value = ''
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  rsaPassword.value = ''
  calibrationPassword.value = ''
  emit('close')
}

async function openChangePasswordDialog() {
  showChangePassword.value = true
  await nextTick()
  oldPasswordInput.value?.focus()
}

async function openRotateRsaDialog() {
  showRotateRsa.value = true
  await nextTick()
  rsaPasswordInput.value?.focus()
}

async function openApplyCalibrationDialog() {
  showApplyCalibration.value = true
  await nextTick()
  calibrationPasswordInput.value?.focus()
}

async function runCalibration() {
  calibrating.value = true
  error.value = ''
  // Give the browser a moment to paint the spinner
  await new Promise((resolve) => setTimeout(resolve, 0))

  try {
    suggestedCryptoParams.value = await cryptoService.calibrateToDeviceCapability()
    showNotification('Calibration complete!', 'success')
  } catch {
    error.value = 'Calibration failed'
  } finally {
    calibrating.value = false
  }
}

async function handleRunFullBenchmark() {
  benchmarking.value = true
  error.value = ''

  try {
    await runFullBenchmarks(benchmarkMode.value)
    showNotification(`Completed ${benchmarkResults.value.length} benchmarks`, 'success')
  } catch {
    error.value = 'Benchmarking failed'
  } finally {
    benchmarking.value = false
  }
}

async function handleApplyCalibration() {
  if (!suggestedCryptoParams.value) return

  applyingCalibration.value = true
  error.value = ''

  try {
    // Re-encrypt the private key with the SAME password but NEW argon2Params
    await cryptoService.updatePassword(calibrationPassword.value, calibrationPassword.value)

    // Update the stored settings so future rotations/password changes use the new params
    settings.value.argon2Params = suggestedCryptoParams.value.params

    showNotification('Security parameters strengthened successfully!', 'success')
    suggestedCryptoParams.value = null
    closeDialogs()
  } catch (err) {
    error.value = err instanceof Error && err.message ? err.message : 'Failed to apply calibration'
  } finally {
    applyingCalibration.value = false
  }
}

async function handleChangePassword() {
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'New passwords do not match'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await cryptoService.updatePassword(oldPassword.value, newPassword.value)
    closeDialogs()
    showNotification('Password changed successfully!', 'success')
  } catch (err) {
    error.value = err instanceof Error && err.message ? err.message : 'Failed to change password'
  } finally {
    loading.value = false
  }
}

async function handleRotateRsa() {
  loading.value = true
  error.value = ''

  try {
    await cryptoService.rotateRsaKeys(rsaPassword.value)
    closeDialogs()
    showNotification('RSA keys rotated successfully!', 'success')
  } catch (err) {
    error.value = err instanceof Error && err.message ? err.message : 'Failed to rotate RSA keys'
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.settings {
  border-top: 1px solid var(--color-border);
  padding-top: 32px;
  margin-top: 32px;

  h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-heading);
    margin: 0 0 24px 0;
  }
}

.setting-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  h3 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-heading);
    margin: 0 0 8px 0;
  }

  p {
    font-size: 0.875rem;
    color: var(--color-muted);
    margin: 0 0 16px 0;
    line-height: 1.6;

    &:last-of-type {
      margin-bottom: 16px;
    }
  }

  &.suspicious {
    border-color: #fca5a5;
    background: linear-gradient(135deg, rgba(254, 226, 226, 0.3) 0%, rgba(255, 245, 245, 0.3) 100%);

    &:hover {
      border-color: #ee6d6d;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    h3 {
      color: #7f1d1d;
    }

    @media (prefers-color-scheme: dark) {
      border-color: #7f1d1d;
      background: linear-gradient(135deg, rgba(127, 29, 29, 0.2) 0%, rgba(159, 18, 18, 0.1) 100%);

      h3 {
        color: #fca5a5;
      }
    }
  }

  button {
    transition: all 0.2s ease;
  }
}

.select-wrapper {
  margin-top: 12px;

  .timeout-select {
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 100%;
    max-width: 200px;

    &:focus {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
    }
  }
}

.warning {
  color: #b91c1c;
  font-weight: 500;

  @media (prefers-color-scheme: dark) {
    color: #fca5a5;
  }
}

.btn-primary,
.btn-danger {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: capitalize;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-primary {
  background-color: var(--color-accent);
  color: white;

  &:hover:not(:disabled) {
    background-color: #1d4ed8;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }
}

.btn-danger {
  background-color: #dc2626;
  color: white;

  &:hover:not(:disabled) {
    background-color: #b91c1c;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
  }

  @media (prefers-color-scheme: dark) {
    background-color: #991b1b;

    &:hover:not(:disabled) {
      background-color: #dc2626;
    }
  }
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 1000;
  backdrop-filter: blur(2px);
  animation: fadeIn 0.15s ease;

  @media (prefers-color-scheme: dark) {
    background: rgba(0, 0, 0, 0.8);
  }
}

.dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 32px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.2s ease;

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-heading);
    margin: 0 0 16px 0;
  }

  p {
    font-size: 0.875rem;
    color: var(--color-muted);
    margin: 0 0 20px 0;
    line-height: 1.6;

    &.error {
      color: #dc2626;
      background: rgba(220, 38, 38, 0.1);
      padding: 12px;
      border-radius: 6px;
      margin-top: 16px;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
  }

  input {
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.875rem;
    transition: all 0.2s ease;

    &:focus {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
      background: var(--color-surface);
    }

    &::placeholder {
      color: var(--color-muted);
    }
  }
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);

  button {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &:first-child {
      background: var(--color-bg);
      color: var(--color-text);
      border: 1px solid var(--color-border);

      &:hover:not(:disabled) {
        background: var(--color-border);
      }
    }

    &:last-child {
      background: var(--color-accent);
      color: white;

      &:hover:not(:disabled) {
        background: #1d4ed8;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 640px) {
  .settings {
    padding-top: 24px;
    margin-top: 24px;

    h2 {
      font-size: 1rem;
      margin-bottom: 16px;
    }
  }

  .setting-section {
    padding: 16px;
    margin-bottom: 12px;

    h3 {
      font-size: 0.9rem;
    }

    p {
      font-size: 0.8125rem;
    }
  }

  .dialog {
    padding: 24px;
    max-width: 100%;
  }
}

.params-display {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
  background: var(--color-bg);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .label {
    font-size: 0.75rem;
    color: var(--color-muted);
    font-weight: 500;
  }

  .value {
    font-size: 0.875rem;
    color: var(--color-text);
    font-family: var(--font-mono);
    font-weight: 600;
  }
}

.info-text {
  font-style: italic;
  font-size: 0.8125rem;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.calibration-result {
  margin-top: 20px;
  padding: 16px;
  background: rgba(37, 99, 235, 0.05);
  border: 1px dashed var(--color-accent);
  border-radius: 8px;

  p {
    margin-bottom: 8px;
    color: var(--color-text);
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0 0 16px 0;
    font-size: 0.875rem;

    li {
      margin-bottom: 4px;
      padding-left: 16px;
      position: relative;

      &::before {
        content: '•';
        position: absolute;
        left: 0;
        color: var(--color-accent);
      }
    }
  }
}

.btn-secondary {
  padding: 8px 16px;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--color-border);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.75rem;
}

.spinner-icon {
  display: inline-block;
  width: 120px;
  height: 120px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: currentColor;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
  width: 14px;
  height: 14px;
  vertical-align: middle;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.benchmark-tool {
  margin-top: 24px;
  padding-top: 24px;

  hr {
    border: 0;
    border-top: 1px solid var(--color-border);
    margin-bottom: 24px;
  }

  h4 {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--color-heading);
  }

  p {
    margin-bottom: 16px;
  }
}

.benchmark-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;

  .timeout-select {
    flex: 1;
    max-width: 150px;
  }
}

.benchmark-results {
  margin-top: 16px;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;

    th,
    td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--color-border);
    }

    th {
      background: var(--color-bg);
      font-weight: 600;
      color: var(--color-muted);
    }

    tr:last-child td {
      border-bottom: none;
    }

    .slow-result,
    .error {
      color: #dc2626;
      font-weight: 600;
    }
  }
}
</style>
