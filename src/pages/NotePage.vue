<template>
  <NoteTextArea
    v-model="noteText"
    :loading="loading"
    :error="error"
    :save-status="saveStatus"
    @save="handleSave"
    @lock="handleLock"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useEncryptedNote } from '../composables/useEncryptedNote'
import { useSessionKeys } from '../composables/useSessionKeys'
import { useSettings } from '../composables/useSettings'
import { useAutoLock } from '../composables/useAutoLock'
import { useNoteState } from '../composables/useNoteState'
import { cryptoService } from '../utils/crypto/cryptoService'
import NoteTextArea from '../components/note/NoteTextArea.vue'

const STORAGE_KEY = 'app-note'

const router = useRouter()
const { clearMasterKey } = useSessionKeys()
const { resetSettings } = useSettings()
const { noteText } = useNoteState()
const { saveNote, error, loading } = useEncryptedNote(STORAGE_KEY)

const saveStatus = ref('')

useAutoLock(handleLock)

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
  noteText.value = ''
  error.value = null
  saveStatus.value = ''
  router.push('/unlock')
}
</script>
