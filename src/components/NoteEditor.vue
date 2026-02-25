<template>
  <div class="note-container">
    <h1>Note</h1>

    <UnlockForm
      v-if="!unlocked"
      v-model="passwordInput"
      :note-exists="hasNote()"
      :loading="loading"
      :error="error"
      @unlock="handleUnlock"
      @drop="showDropConfirm = true"
    />

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
      message="This will permanently delete your encrypted note and its key. You will not be able to recover it. Are you sure?"
      confirm-label="Drop Database"
      @confirm="handleDrop"
      @cancel="showDropConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useEncryptedNote } from '../composables/useEncryptedNote'
import UnlockForm from './UnlockForm.vue'
import NoteArea from './NoteArea.vue'
import ConfirmDialog from './ConfirmDialog.vue'

const STORAGE_KEY = 'app-note'

const { saveNote, loadNote, hasNote, dropDatabase, loading, error } = useEncryptedNote(STORAGE_KEY)

const passwordInput = ref('')
const noteText = ref('')
const unlocked = ref(false)
const saveStatus = ref('')
const showDropConfirm = ref(false)

async function handleUnlock() {
  if (!passwordInput.value) return
  if (hasNote()) {
    const result = await loadNote(passwordInput.value)
    if (result !== null) {
      noteText.value = result
      unlocked.value = true
    }
  } else {
    unlocked.value = true
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

function handleDrop() {
  dropDatabase()
  showDropConfirm.value = false
  unlocked.value = false
  noteText.value = ''
  passwordInput.value = ''
  saveStatus.value = ''
}
</script>

<style scoped>
.note-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 640px;
}

h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 24px 0;
  color: var(--color-heading);
}
</style>
