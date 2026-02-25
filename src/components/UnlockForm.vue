<template>
  <div class="unlock-form">
    <p class="unlock-desc">
      {{ noteExists ? 'Enter your password to decrypt your note.' : 'Set a password to encrypt your note.' }}
    </p>
    <div class="field">
      <label for="password">Password</label>
      <input
        id="password"
        :value="modelValue"
        type="password"
        placeholder="Enter password..."
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter="noteExists ? $emit('unlock') : undefined"
      />
    </div>
    <div v-if="!noteExists" class="field">
      <label for="confirm-password">Confirm Password</label>
      <input
        id="confirm-password"
        v-model="confirmPassword"
        type="password"
        placeholder="Confirm password..."
        @keydown.enter="handleCreate"
      />
      <p v-if="confirmMismatch" class="error-msg">Passwords do not match.</p>
    </div>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <div class="form-actions">
      <button
        class="btn-primary"
        :disabled="loading || !modelValue || (!noteExists && !confirmPassword)"
        @click="noteExists ? $emit('unlock') : handleCreate()"
      >
        {{ loading ? 'Loading...' : noteExists ? 'Decrypt & Open' : 'Create Note' }}
      </button>
      <button v-if="noteExists" class="btn-drop" @click="$emit('drop')">
        Drop Database
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string
  noteExists: boolean
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  unlock: []
  drop: []
}>()

const confirmPassword = ref('')
const confirmMismatch = ref(false)

function handleCreate() {
  if (props.modelValue !== confirmPassword.value) {
    confirmMismatch.value = true
    return
  }
  confirmMismatch.value = false
  emit('unlock')
}

watch(confirmPassword, () => {
  confirmMismatch.value = false
})
</script>

<style scoped>
.unlock-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.unlock-desc {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-muted);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
}

input[type='password'] {
  width: 100%;
  padding: 10px 14px;
  font-size: 1rem;
  font-family: inherit;
  color: var(--color-text);
  background-color: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

input[type='password']:focus {
  border-color: var(--color-accent);
}

.error-msg {
  margin: 0;
  font-size: 0.85rem;
  color: #dc2626;
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.btn-primary {
  padding: 9px 22px;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  color: #fff;
  background-color: var(--color-accent);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.88;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-drop {
  padding: 9px 18px;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  color: #dc2626;
  background-color: transparent;
  border: 1.5px solid #dc2626;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  margin-left: auto;
}

.btn-drop:hover {
  background-color: #dc2626;
  color: #fff;
}
</style>
