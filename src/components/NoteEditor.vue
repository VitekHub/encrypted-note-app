<template>
  <div class="note-container">
    <h1>Note</h1>

    <div v-if="!unlocked" class="unlock-form">
      <p class="unlock-desc">
        {{ hasNote() ? 'Enter your password to decrypt your note.' : 'Set a password to encrypt your note.' }}
      </p>
      <div class="field">
        <label for="password">Password</label>
        <input
          id="password"
          v-model="passwordInput"
          type="password"
          placeholder="Enter password..."
          @keydown.enter="handleUnlock"
        />
      </div>
      <p v-if="error" class="error-msg">{{ error }}</p>
      <button class="btn-primary" :disabled="loading || !passwordInput" @click="handleUnlock">
        {{ loading ? 'Loading...' : hasNote() ? 'Decrypt & Open' : 'Create Note' }}
      </button>
    </div>

    <template v-else>
      <textarea
        v-model="noteText"
        class="note-input"
        placeholder="Start typing your note..."
        spellcheck="true"
      />
      <div class="actions">
        <p v-if="saveStatus" class="save-status">{{ saveStatus }}</p>
        <div class="btn-row">
          <button class="btn-secondary" @click="handleLock">Lock</button>
          <button class="btn-primary" :disabled="loading" @click="handleSave">
            {{ loading ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
      <p v-if="error" class="error-msg">{{ error }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useEncryptedNote } from '../composables/useEncryptedNote'

const STORAGE_KEY = 'app-note'

const { saveNote, loadNote, hasNote, loading, error } = useEncryptedNote(STORAGE_KEY)

const passwordInput = ref('')
const noteText = ref('')
const unlocked = ref(false)
const saveStatus = ref('')

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

.unlock-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.unlock-desc {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-muted);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
}

input[type='password'] {
  width: 100%;
  padding: 10px 14px;
  font-size: 1rem;
  font-family: inherit;
  color: var(--color-text);
  background-color: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

input[type='password']:focus {
  border-color: var(--color-accent);
}

.note-input {
  width: 100%;
  min-height: 320px;
  padding: 16px;
  font-size: 1rem;
  font-family: inherit;
  line-height: 1.6;
  color: var(--color-text);
  background-color: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
}

.note-input:focus {
  border-color: var(--color-accent);
}

.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  min-height: 36px;
}

.btn-row {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.save-status {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-muted);
}

.error-msg {
  margin: 0;
  font-size: 0.85rem;
  color: #dc2626;
}

.btn-primary {
  padding: 9px 22px;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  color: #fff;
  background-color: var(--color-accent);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.88;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 9px 18px;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--color-text);
  background-color: transparent;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.btn-secondary:hover {
  border-color: var(--color-accent);
  background-color: var(--color-surface);
}
</style>
