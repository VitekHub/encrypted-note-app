<template>
  <div class="note-container">
    <header class="toolbar">
      <h1>
        <img src="/favicon.svg" alt="lock icon" class="title-icon" />
        CipherNote
      </h1>
      <ThemeToggle />
    </header>

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

    <NoteArea
      v-else
      v-model="noteText"
      :loading="loading"
      :error="error"
      :save-status="saveStatus"
      @save="handleSave"
      @lock="handleLock"
    />

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
import { useEncryptedNote } from '../composables/useEncryptedNote'
import { useSessionKeys } from '../composables/useSessionKeys'
import { cryptoService } from '../utils/crypto/cryptoService'
import UnlockForm from './UnlockForm.vue'
import NoteArea from './NoteArea.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import AppInfo from './AppInfo.vue'
import ThemeToggle from './ThemeToggle.vue'

const STORAGE_KEY = 'app-note'

const { saveNote, loadNote, clearNote, loading, error } = useEncryptedNote(STORAGE_KEY)
const { setMasterKey, clearMasterKey } = useSessionKeys()

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
      const key = await cryptoService.setup(passwordInput.value)
      setMasterKey(key)
      keysExist.value = true
      unlocked.value = true
    } else {
      const key = await cryptoService.unlock(passwordInput.value)
      setMasterKey(key)
      const result = await loadNote()
      if (result !== null) {
        noteText.value = result
      }
      if (!error.value) {
        unlocked.value = true
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to unlock'
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
  clearMasterKey()
  unlocked.value = false
  noteText.value = ''
  passwordInput.value = ''
  error.value = null
  saveStatus.value = ''
}

async function handleDrop() {
  await cryptoService.teardown()
  clearNote()
  clearMasterKey()
  showDropConfirm.value = false
  unlocked.value = false
  noteText.value = ''
  passwordInput.value = ''
  saveStatus.value = ''
  keysExist.value = false
}
</script>

<style lang="scss" scoped>
.note-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 640px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 24px 0;

  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
    color: var(--color-heading);
  }
}

.title-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
</style>
