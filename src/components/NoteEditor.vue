<template>
  <div class="flex flex-col w-full max-w-[640px]">
    <AppHeader />

    <template v-if="!unlocked">
      <UnlockForm
        v-model="passwordInput"
        :signing-up="signingUp"
        :loading="loading"
        :error="error"
        @unlock="handleUnlock"
        @drop="showDropConfirm = true"
      />
      <AppInfo />
    </template>

    <div v-else>
      <NoteTextArea
        v-model="noteText"
        :loading="loading"
        :error="error"
        :save-status="saveStatus"
        @save="handleSave"
        @lock="handleLock"
      />
      <Settings />
    </div>

    <ConfirmDialog
      v-if="showDropConfirm"
      title="Drop Database"
      message="This will permanently delete your encrypted note and all encryption keys. You will not be able to recover it. Are you sure?"
      confirm-label="Drop Database"
      @confirm="handleDrop"
      @cancel="showDropConfirm = false"
    />

    <NotificationContainer />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEncryptedNote } from '../composables/useEncryptedNote'
import { useSessionKeys } from '../composables/useSessionKeys'
import { useAutoLock } from '../composables/useAutoLock'
import { cryptoService } from '../utils/crypto/cryptoService'
import { useSettings } from '../composables/useSettings'
import AppHeader from './layout/AppHeader.vue'
import UnlockForm from './auth/UnlockForm.vue'
import NoteTextArea from './note/NoteTextArea.vue'
import ConfirmDialog from './ui/ConfirmDialog.vue'
import AppInfo from './info/AppInfo.vue'
import Settings from './settings/Settings.vue'
import NotificationContainer from './notification/NotificationContainer.vue'

const STORAGE_KEY = 'app-note'

const { saveNote, loadNote, clearNote, loading, error } = useEncryptedNote(STORAGE_KEY)
const { setMasterKey, clearMasterKey } = useSessionKeys()
const { settings, resetSettings } = useSettings()

useAutoLock(handleLock)

const passwordInput = ref('')
const noteText = ref('')
const unlocked = ref(false)
const saveStatus = ref('')
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
      unlocked.value = true
    } else {
      const { masterKey, params } = await cryptoService.unlock(passwordInput.value)
      setMasterKey(masterKey)
      settings.value.argon2Params = params
      const result = await loadNote()
      if (result !== null) {
        noteText.value = result
      }
      if (!error.value) {
        unlocked.value = true
      }
    }
  } catch (e) {
    error.value = e instanceof Error && e.message ? e.message : 'Failed to unlock'
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saveStatus.value = ''
  await saveNote(noteText.value)
  if (!error.value) {
    saveStatus.value = 'Saved.'
    setTimeout(() => (saveStatus.value = ''), 2000)
  }
}

function handleLock() {
  cryptoService.lock()
  clearMasterKey()
  resetSettings()
  unlocked.value = false
  noteText.value = ''
  passwordInput.value = ''
  error.value = null
  saveStatus.value = ''
}

async function handleDrop() {
  await cryptoService.teardown()
  clearNote()
  handleLock()
  showDropConfirm.value = false
  keysExist.value = false
}
</script>
