<template>
  <div class="note-container">
    <header class="toolbar">
      <h1>
        <img src="/favicon.svg" alt="lock icon" class="title-icon" />
        Encrypted Note App
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
import { rsaKeyService } from '../utils/crypto/keys/asymmetric/rsa'
import UnlockForm from './UnlockForm.vue'
import NoteArea from './NoteArea.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import AppInfo from './AppInfo.vue'
import ThemeToggle from './ThemeToggle.vue'

const STORAGE_KEY = 'app-note'

const { saveNote, loadNote, dropDatabase, loading, error } = useEncryptedNote(STORAGE_KEY)

const passwordInput = ref('')
const noteText = ref('')
const unlocked = ref(false)
const saveStatus = ref('')
const showDropConfirm = ref(false)
const keysExist = ref(false)

const signingUp = computed(() => !keysExist.value)

onMounted(async () => {
  keysExist.value = await rsaKeyService.hasKeys()
})

async function handleUnlock() {
  if (!passwordInput.value) return
  if (signingUp.value) {
    loading.value = true
    try {
      const keyPair = await rsaKeyService.generateKeys(passwordInput.value)
      await rsaKeyService.storeKeys(keyPair)
      keysExist.value = true
      unlocked.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to generate encryption keys'
    } finally {
      loading.value = false
    }
  } else {
    const result = await loadNote(passwordInput.value)
    if (result !== null) {
      noteText.value = result
    }
    if (!error.value) {
      unlocked.value = true
    }
  }
}

async function handleSave() {
  saveStatus.value = ''
  await saveNote(noteText.value, passwordInput.value)
  if (!error.value) {
    saveStatus.value = 'Saved.'
    setTimeout(() => (saveStatus.value = ''), 2000)
  }
}

function handleLock() {
  unlocked.value = false
  noteText.value = ''
  passwordInput.value = ''
  error.value = null
  saveStatus.value = ''
}

async function handleDrop() {
  await rsaKeyService.deleteKeys()
  dropDatabase()
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
