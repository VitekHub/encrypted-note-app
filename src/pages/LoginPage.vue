<template>
  <div>
    <LoginForm :loading="loading" :error="error" @submit="handleSubmit" />
    <div class="page-separator" />
    <AppInfo />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../stores/authStore'
import LoginForm from '../components/auth/LoginForm.vue'
import AppInfo from '../components/info/AppInfo.vue'

const router = useRouter()
const authStore = useAuthStore()
const { isLoading: loading, error } = storeToRefs(authStore)

async function handleSubmit(mode: 'signin' | 'signup', usernameArg: string, password: string) {
  try {
    if (mode === 'signup') {
      await authStore.setup(usernameArg, password)
    } else {
      await authStore.unlock(usernameArg, password)
    }
    router.push('/')
  } catch {
    // error is set by the store
  }
}
</script>

<style scoped>
.page-separator {
  margin-top: 2rem;
  margin-bottom: 1.75rem;
  border-top: 1.5px solid var(--color-border);
}
</style>
