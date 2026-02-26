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
        @input="handlePasswordInput"
        @keydown.enter="noteExists ? $emit('unlock') : undefined"
      />
      <p v-if="!noteExists" class="hint-msg">
        <span v-if="policyErrors.length" class="error-list">{{ policyErrors.join(', ') }}</span>
        <span v-else-if="!modelValue">Minimum 8 characters. Spaces and all character types accepted.</span>
        <span v-else-if="policyChecking">Checking...</span>
        <span v-else-if="passwordStrength.score < 3">Password is ok, but you should add capital letters and/or numbers.</span>
        <span v-else>You've chosen a solid password.</span>
      </p>
      <PasswordStrength v-if="!noteExists && modelValue" :password="modelValue" />
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
        :disabled="isSubmitDisabled"
        @click="noteExists ? $emit('unlock') : handleCreate()"
      >
        {{ submitLabel }}
      </button>
      <button v-if="noteExists" class="btn-drop" @click="$emit('drop')">
        Drop Database
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { validatePassword } from '../utils/passwordPolicy'
import { getPasswordStrength } from '../utils/passwordPolicy'
import PasswordStrength from './PasswordStrength.vue'

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
const policyErrors = ref<string[]>([])
const policyChecking = ref(false)
const policyDirty = ref(false)
const passwordStrength = computed(() => getPasswordStrength(props.modelValue))

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function handlePasswordInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)
  policyDirty.value = true
  policyErrors.value = []

  if (props.noteExists) return

  if (debounceTimer) clearTimeout(debounceTimer)
  policyChecking.value = true
  debounceTimer = setTimeout(() => runPolicyCheck(value), 600)
}

async function runPolicyCheck(password: string) {
  if (!password) {
    policyErrors.value = []
    return
  }
  policyChecking.value = true
  try {
    const result = await validatePassword(password)
    policyErrors.value = result.errors
  } finally {
    policyChecking.value = false
  }
}

async function handleCreate() {
  if (props.modelValue !== confirmPassword.value) {
    confirmMismatch.value = true
    return
  }
  confirmMismatch.value = false

  policyChecking.value = true
  try {
    const result = await validatePassword(props.modelValue)
    policyErrors.value = result.errors
    if (!result.valid) return
  } finally {
    policyChecking.value = false
  }

  emit('unlock')
}

watch(confirmPassword, () => {
  confirmMismatch.value = false
})

const isSubmitDisabled = computed(() => {
  if (props.loading || policyChecking.value || !props.modelValue) return true
  if (!props.noteExists) {
    if (!confirmPassword.value) return true
    if (policyDirty.value && policyErrors.value.length > 0) return true
  }
  return false
})

const submitLabel = computed(() => {
  if (policyChecking.value) return 'Checking...'
  if (props.loading) return 'Loading...'
  return props.noteExists ? 'Decrypt & Open' : 'Create Note'
})
</script>

<style lang="scss" scoped>
$color-danger: #dc2626;

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
  box-sizing: border-box;

  &:focus {
    border-color: var(--color-accent);
  }
}

.hint-msg {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-muted);
}

.error-msg {
  margin: 0;
  font-size: 0.85rem;
  color: $color-danger;
}

.error-list {
  color: $color-danger;
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

  &:hover:not(:disabled) {
    opacity: 0.88;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-drop {
  padding: 9px 18px;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  color: $color-danger;
  background-color: transparent;
  border: 1.5px solid $color-danger;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  margin-left: auto;

  &:hover {
    background-color: $color-danger;
    color: #fff;
  }
}
</style>
