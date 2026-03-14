<template>
  <div class="flex flex-col w-full">
    <textarea
      :value="modelValue"
      class="note-input"
      placeholder="Start typing your note..."
      spellcheck="true"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <div class="actions">
      <p v-if="saveStatus" class="save-status">{{ saveStatus }}</p>
      <div class="flex gap-2.5 ml-auto">
        <button class="btn-base btn-secondary" @click="$emit('lock')">Lock</button>
        <button class="btn-base btn-primary" :disabled="loading" @click="$emit('save')">
          {{ loading ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
    <p v-if="error" class="error-text mt-1">{{ error }}</p>
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
@reference "tailwindcss";
.note-input {
  @apply w-full outline-none resize-y box-border font-[inherit] leading-[1.6];
  min-height: 320px;
  padding: 16px;
  font-size: 1rem;
  color: var(--color-text);
  background-color: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--color-accent);
  }
}

.actions {
  @apply flex items-center justify-between mt-3;
  min-height: 36px;
}

.save-status {
  @apply m-0;
  font-size: 0.82rem;
  color: var(--color-muted);
}
</style>
