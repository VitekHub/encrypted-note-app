<template>
  <div class="settings">
    <h2>Security Settings</h2>

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
import { cryptoService } from '../utils/crypto/cryptoService'
import { useNotification } from '../composables/useNotification'

const emit = defineEmits<{
  close: []
}>()

const { showNotification } = useNotification()

const showChangePassword = ref(false)
const showRotateRsa = ref(false)
const loading = ref(false)
const error = ref('')

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const rsaPassword = ref('')

const oldPasswordInput = ref<HTMLInputElement>()
const rsaPasswordInput = ref<HTMLInputElement>()

function closeDialogs() {
  showChangePassword.value = false
  showRotateRsa.value = false
  loading.value = false
  error.value = ''
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  rsaPassword.value = ''
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
</style>
