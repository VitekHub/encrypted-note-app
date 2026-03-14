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
import { useEncryptedNote } from '../composables/useEncryptedNote'
import { useSessionKeys } from '../composables/useSessionKeys'
import { useSettings } from '../composables/useSettings'
import { useNoteState } from '../composables/useNoteState'
import { cryptoService } from '../utils/crypto/cryptoService'
import UnlockForm from '../components/auth/UnlockForm.vue'
import AppInfo from '../components/info/AppInfo.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'

const STORAGE_KEY = 'app-note'

const router = useRouter()
const { setMasterKey, clearMasterKey } = useSessionKeys()
const { settings } = useSettings()
const { noteText } = useNoteState()
const { loadNote, clearNote, loading, error } = useEncryptedNote(STORAGE_KEY)

const passwordInput = ref('')
const showDropConfirm = ref(false)
const keysExist = ref(false)

const signingUp = computed(() => !keysExist.value)

onMounted(async () => {
  keysExist.value = await cryptoService.isSetUp()
})

async function handleUnlock() {
  if (!passwordInput.value) return
  loading.value = true
  try {
    if (signingUp.value) {
      const { masterKey, params } = await cryptoService.setup(passwordInput.value)
      setMasterKey(masterKey)
      settings.value.argon2Params = params
      keysExist.value = true
      router.push('/')
    } else {
      const { masterKey, params } = await cryptoService.unlock(passwordInput.value)
      setMasterKey(masterKey)
      settings.value.argon2Params = params
      const result = await loadNote()
      if (!error.value) {
        if (result !== null) {
          noteText.value = result
        }
        router.push('/')
      }
    }
  } catch (e) {
    error.value = e instanceof Error && e.message ? e.message : 'Failed to unlock'
  } finally {
    loading.value = false
  }
}

async function handleDrop() {
  clearMasterKey()
  await cryptoService.teardown()
  clearNote()
  showDropConfirm.value = false
  keysExist.value = false
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
