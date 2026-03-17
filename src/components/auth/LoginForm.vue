<template>
  <div class="flex flex-col gap-4">
    <div class="mode-toggle">
      <button class="mode-btn" :class="{ active: mode === 'signin' }" @click="mode = 'signin'">Sign In</button>
      <button class="mode-btn" :class="{ active: mode === 'signup' }" @click="mode = 'signup'">Create Account</button>
    </div>

    <p class="muted-text">
      {{
        mode === 'signup'
          ? 'Choose a username and passphrase to protect your note.'
          : 'Enter your credentials to decrypt your note.'
      }}
    </p>

    <div class="field">
      <BaseInput
        v-model="usernameInput"
        label="Username"
        type="text"
        placeholder="Enter username..."
        autocomplete="username"
        @keydown.enter="focusPassword"
      />
      <div class="hint-msg">
        <p v-if="usernameErrors.length">
          <span class="error-text">{{ usernameErrors.join(', ') }}</span>
        </p>
        <p v-else-if="mode === 'signup' && usernameInput && usernameChecking">Checking availability...</p>
        <p v-else-if="mode === 'signup' && usernameInput && usernameAvailable === false" class="error-text">
          Username already taken.
        </p>
        <p v-else-if="mode === 'signup' && usernameInput && usernameAvailable === true" class="success-text">
          Username is available.
        </p>
      </div>
    </div>

    <div class="field">
      <BaseInput
        id="passphrase"
        :model-value="passwordInput"
        label="Passphrase"
        type="password"
        placeholder="Enter passphrase..."
        autocomplete="current-password"
        @update:model-value="handlePasswordInput"
        @keydown.enter="mode === 'signin' ? handleSubmit() : undefined"
      />
      <p v-if="mode === 'signup'" class="hint-msg">
        <span v-if="policyErrors.length" class="error-text">{{ policyErrors.join(', ') }}</span>
        <span v-else-if="!passwordInput">Minimum 8 characters. Spaces and all character types accepted.</span>
        <span v-else-if="policyChecking">Checking...</span>
        <span v-else-if="passwordStrength.score < 3">Passphrase is ok, but stronger is better.</span>
        <span v-else>You've chosen a solid passphrase.</span>
      </p>
      <PasswordStrength v-if="mode === 'signup' && passwordInput" :password="passwordInput" />
    </div>

    <div v-if="mode === 'signup'" class="field">
      <BaseInput
        v-model="confirmPassword"
        label="Confirm Passphrase"
        type="password"
        placeholder="Confirm passphrase..."
        autocomplete="new-password"
        :error="confirmMismatch ? 'Passphrases do not match.' : ''"
        @keydown.enter="handleSubmit"
      />
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>

    <div class="flex items-center justify-between gap-2.5">
      <BaseButton :disabled="isSubmitDisabled" :loading="loading" @click="handleSubmit">
        {{ submitLabel }}
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { validatePassword, getPasswordStrength } from '../../utils/auth/passwordPolicy'
import { validateUsername, isUsernameAvailable } from '../../utils/auth/usernameAuthService'
import PasswordStrength from './PasswordStrength.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseButton from '../ui/BaseButton.vue'

const props = defineProps<{
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  submit: [mode: 'signin' | 'signup', username: string, password: string]
}>()

const mode = ref<'signin' | 'signup'>('signin')
const usernameInput = ref('')
const passwordInput = ref('')
const confirmPassword = ref('')
const confirmMismatch = ref(false)
const policyErrors = ref<string[]>([])
const policyChecking = ref(false)
const policyDirty = ref(false)
const usernameErrors = ref<string[]>([])
const usernameChecking = ref(false)
const usernameAvailable = ref<boolean | null>(null)

const passwordStrength = computed(() => getPasswordStrength(passwordInput.value))

let passwordDebounce: ReturnType<typeof setTimeout> | null = null
let usernameDebounce: ReturnType<typeof setTimeout> | null = null

function focusPassword() {
  document.getElementById('passphrase')?.focus()
}

function handlePasswordInput(value: string) {
  passwordInput.value = value
  policyDirty.value = true
  policyErrors.value = []

  if (mode.value !== 'signup') return

  if (passwordDebounce) clearTimeout(passwordDebounce)
  policyChecking.value = true
  passwordDebounce = setTimeout(() => runPolicyCheck(value), 600)
}

async function runPolicyCheck(password: string) {
  if (!password) {
    policyErrors.value = []
    policyChecking.value = false
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

watch(usernameInput, (val) => {
  usernameAvailable.value = null
  usernameErrors.value = []
  if (mode.value !== 'signup' || !val) return

  const errs = validateUsername(val)
  if (errs.length) {
    usernameErrors.value = errs
    return
  }

  if (usernameDebounce) clearTimeout(usernameDebounce)
  usernameChecking.value = true
  usernameDebounce = setTimeout(async () => {
    try {
      usernameAvailable.value = await isUsernameAvailable(val)
    } catch {
      usernameAvailable.value = null
    } finally {
      usernameChecking.value = false
    }
  }, 500)
})

watch(mode, () => {
  usernameErrors.value = []
  usernameAvailable.value = null
  policyErrors.value = []
  confirmMismatch.value = false
  confirmPassword.value = ''
  policyDirty.value = false
})

watch(confirmPassword, () => {
  confirmMismatch.value = false
})

async function handleSubmit() {
  if (isSubmitDisabled.value) return

  if (mode.value === 'signup') {
    if (passwordInput.value !== confirmPassword.value) {
      confirmMismatch.value = true
      return
    }
    confirmMismatch.value = false

    policyChecking.value = true
    try {
      const result = await validatePassword(passwordInput.value)
      policyErrors.value = result.errors
      if (!result.valid) return
    } finally {
      policyChecking.value = false
    }
  }

  emit('submit', mode.value, usernameInput.value, passwordInput.value)
}

const isSubmitDisabled = computed(() => {
  if (props.loading || !usernameInput.value || !passwordInput.value) return true
  if (mode.value === 'signup') {
    if (policyChecking.value || usernameChecking.value) return true
    if (!confirmPassword.value) return true
    if (policyDirty.value && policyErrors.value.length > 0) return true
    if (usernameErrors.value.length > 0) return true
    if (usernameAvailable.value === false) return true
  }
  return false
})

const submitLabel = computed(() => {
  if (policyChecking.value || usernameChecking.value) return 'Checking...'
  if (props.loading) return 'Loading...'
  return mode.value === 'signup' ? 'Create Account' : 'Decrypt & Open'
})
</script>

<style scoped>
@reference "tailwindcss";

.mode-toggle {
  @apply flex rounded-lg overflow-hidden border;
  border-color: var(--color-border);
}

.mode-btn {
  @apply flex-1 py-2 text-sm font-medium cursor-pointer border-none font-[inherit] transition-colors duration-150 bg-transparent;
  color: var(--color-muted);
}

.mode-btn.active {
  background-color: var(--color-surface);
  color: var(--color-heading);
}

.mode-btn:hover:not(.active) {
  color: var(--color-text);
}

.hint-msg {
  @apply m-0;
  font-size: 0.8rem;
  color: var(--color-muted);
}

.success-text {
  color: var(--color-success);
}
</style>
