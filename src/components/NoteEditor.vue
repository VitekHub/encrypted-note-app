<template>
  <div class="note-container">
    <h1>Note</h1>
    <textarea
      v-model="note"
      class="note-input"
      placeholder="Start typing your note..."
      spellcheck="true"
    />
    <p class="hint">Your note is saved automatically.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const STORAGE_KEY = 'app-note'

const note = computed({
  get: () => localStorage.getItem(STORAGE_KEY) ?? '',
  set: (value: string) => localStorage.setItem(STORAGE_KEY, value),
})
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
  margin: 0 0 16px 0;
  color: var(--color-heading);
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
  box-sizing: border-box;
}

.note-input:focus {
  border-color: var(--color-accent);
}

.hint {
  margin: 10px 0 0 0;
  font-size: 0.8rem;
  color: var(--color-muted);
}
</style>
