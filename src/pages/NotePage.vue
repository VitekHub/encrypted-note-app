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
import { storeToRefs } from 'pinia'
import { useNoteStore } from '../stores/noteStore'
import { useAutoLock } from '../composables/useAutoLock'
import { useAuthStore } from '../stores/authStore'
import NoteTextArea from '../components/note/NoteTextArea.vue'

const router = useRouter()
const authStore = useAuthStore()
const noteStore = useNoteStore()
const { noteText, loading, error } = storeToRefs(noteStore)

const saveStatus = ref('')

useAutoLock(handleLock)

async function handleSave() {
  saveStatus.value = ''
  await noteStore.saveNote(noteText.value)
  if (!error.value) {
    saveStatus.value = 'Saved.'
    setTimeout(() => (saveStatus.value = ''), 2000)
  }
}

async function handleLock() {
  await authStore.lock()
  error.value = null
  saveStatus.value = ''
  router.push('/unlock')
}
</script>
