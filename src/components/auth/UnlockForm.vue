<template>
  <div class="flex flex-col gap-4">
    <p class="muted-text">
      {{ signingUp ? 'Set a password to encrypt your note.' : 'Enter your password to decrypt your note.' }}
    </p>

    <div class="field">
      <BaseInput
        :model-value="modelValue"
        label="Password"
        type="password"
        placeholder="Enter password..."
        @update:model-value="handlePasswordInput"
        @keydown.enter="signingUp ? undefined : $emit('unlock')"
      />
      <p v-if="signingUp" class="hint-msg">
        <span v-if="policyErrors.length" class="error-text">{{ policyErrors.join(', ') }}</span>
        <span v-else-if="!modelValue">Minimum 8 characters. Spaces and all character types accepted.</span>
        <span v-else-if="policyChecking">Checking...</span>
        <span v-else-if="passwordStrength.score < 3">
          Password is ok, but you should add capital letters and/or numbers.
        </span>
        <span v-else>You've chosen a solid password.</span>
      </p>
      <PasswordStrength v-if="signingUp && modelValue" :password="modelValue" />
    </div>

    <div v-if="signingUp" class="field">
      <BaseInput
        v-model="confirmPassword"
        label="Confirm Password"
        type="password"
        placeholder="Confirm password..."
        :error="confirmMismatch ? 'Passwords do not match.' : ''"
        @keydown.enter="handleCreate"
      />
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>

    <div class="flex items-center justify-between gap-2.5">
      <BaseButton :disabled="isSubmitDisabled" @click="signingUp ? handleCreate() : $emit('unlock')">
        {{ submitLabel }}
      </BaseButton>
      <button v-if="!signingUp" class="btn-drop" @click="$emit('drop')">Drop Database</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { validatePassword, getPasswordStrength } from '../../utils/passwordPolicy'
import PasswordStrength from './PasswordStrength.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseButton from '../ui/BaseButton.vue'

const props = defineProps<{
  modelValue: string
  signingUp: boolean
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

function handlePasswordInput(value: string) {
  emit('update:modelValue', value)
  policyDirty.value = true
  policyErrors.value = []

  if (!props.signingUp) return

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
  if (props.signingUp) {
    if (!confirmPassword.value) return true
    if (policyDirty.value && policyErrors.value.length > 0) return true
  }
  return false
})

const submitLabel = computed(() => {
  if (policyChecking.value) return 'Checking...'
  if (props.loading) return 'Loading...'
  return props.signingUp ? 'Create Note' : 'Decrypt & Open'
})
</script>

<style scoped>
@reference "tailwindcss";
.hint-msg {
  @apply m-0;
  font-size: 0.8rem;
  color: var(--color-muted);
}

.btn-drop {
  @apply bg-transparent cursor-pointer font-medium font-[inherit] ml-auto;
  padding: 9px 18px;
  font-size: 0.9rem;
  color: var(--color-danger);
  border: 1.5px solid var(--color-danger);
  border-radius: 8px;
  transition:
    background-color 0.15s,
    color 0.15s;

  &:hover {
    background-color: var(--color-danger);
    color: var(--color-white);
  }
}
</style>
