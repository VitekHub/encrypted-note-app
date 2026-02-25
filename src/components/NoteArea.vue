<template>
  <div class="note-area">
    <textarea
      :value="modelValue"
      class="note-input"
      placeholder="Start typing your note..."
      spellcheck="true"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <div class="actions">
      <p v-if="saveStatus" class="save-status">{{ saveStatus }}</p>
      <div class="btn-row">
        <button class="btn-secondary" @click="$emit('lock')">Lock</button>
        <button class="btn-primary" :disabled="loading" @click="$emit('save')">
          {{ loading ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
    <p v-if="error" class="error-msg">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  loading: boolean
  error: string | null
  saveStatus: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
  save: []
  lock: []
}>()
</script>

<style scoped>
.note-area {
  display: flex;
  flex-direction: column;
  width: 100%;
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
  margin: 4px 0 0;
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
