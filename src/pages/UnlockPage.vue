<template>
  <div>
    <UnlockForm
      v-model="passwordInput"
      :signing-up="signingUp"
      :loading="loading"
      :error="error"
      @unlock="handleUnlock"
      @drop="showDropConfirm = true"
    />
    <div class="unlock-separator" />
    <AppInfo />

    <ConfirmDialog
      v-if="showDropConfirm"
      title="Drop Database"
      message="This will permanently delete your encrypted note and all encryption keys. You will not be able to recover it. Are you sure?"
      confirm-label="Drop Database"
      @confirm="handleDrop"
      @cancel="showDropConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../stores/authStore'
import { useNoteStore } from '../stores/noteStore'
import UnlockForm from '../components/auth/UnlockForm.vue'
import AppInfo from '../components/info/AppInfo.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const noteStore = useNoteStore()
const { keysExist, isLoading: loading, error } = storeToRefs(authStore)
const { noteText } = storeToRefs(noteStore)

const passwordInput = ref('')
const showDropConfirm = ref(false)

const signingUp = computed(() => !keysExist.value)

onMounted(async () => {
  await authStore.checkKeysExist()
})

async function handleUnlock() {
  if (!passwordInput.value) return
  try {
    if (signingUp.value) {
      await authStore.setup(passwordInput.value)
      router.push('/')
    } else {
      await authStore.unlock(passwordInput.value)
      if (!error.value) {
        const result = await noteStore.loadNote()
        if (result !== null) {
          noteText.value = result
        }
        router.push('/')
      }
    }
  } catch {
    // error is set by the store
  }
}

async function handleDrop() {
  await authStore.teardown()
  noteStore.clearNote()
  showDropConfirm.value = false
  error.value = null
  passwordInput.value = ''
}
</script>

<style scoped>
.unlock-separator {
  margin-top: 2rem;
  margin-bottom: 1.75rem;
  border-top: 1.5px solid var(--color-border);
}
</style>
