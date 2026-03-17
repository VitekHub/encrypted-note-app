<template>
  <div>
    <div class="flex flex-col gap-4">
      <p class="muted-text">
        Welcome back,
        <strong>{{ username }}</strong>
        . Enter your passphrase to continue.
      </p>

      <BaseInput
        v-model="passphraseInput"
        label="Passphrase"
        type="password"
        placeholder="Enter passphrase..."
        autocomplete="current-password"
        @keydown.enter="handleUnlock"
      />

      <p v-if="error" class="error-text">{{ error }}</p>

      <div class="flex items-center justify-between gap-2.5">
        <BaseButton :loading="isLoading" :disabled="!passphraseInput || isLoading" @click="handleUnlock">
          Decrypt & Open
        </BaseButton>
        <button class="btn-switch" @click="handleSwitchAccount">Switch account</button>
      </div>
    </div>

    <div class="page-separator" />
    <AppInfo />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../stores/authStore'
import AppInfo from '../components/info/AppInfo.vue'
import BaseInput from '../components/ui/BaseInput.vue'
import BaseButton from '../components/ui/BaseButton.vue'

const router = useRouter()
const authStore = useAuthStore()
const { isLoading, error, username } = storeToRefs(authStore)

const passphraseInput = ref('')

async function handleUnlock() {
  if (!passphraseInput.value) return
  try {
    await authStore.unlock(username.value!, passphraseInput.value)
    router.push('/')
  } catch {
    // error is set by the store
  }
}

async function handleSwitchAccount() {
  await authStore.logout()
  authStore.error = null
  router.push('/login')
}
</script>

<style scoped>
.page-separator {
  margin-top: 2rem;
  margin-bottom: 1.75rem;
  border-top: 1.5px solid var(--color-border);
}

.btn-switch {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  font-family: inherit;
  color: var(--color-muted);
  padding: 4px 0;
  text-decoration: underline;
  text-underline-offset: 3px;

  &:hover {
    color: var(--color-text);
  }
}
</style>
