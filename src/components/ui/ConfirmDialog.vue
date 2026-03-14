<template>
  <Teleport to="body">
    <div class="dialog-overlay" @click.self="$emit('cancel')">
      <div class="dialog-card">
        <h2 class="dialog-title">{{ title }}</h2>
        <p class="dialog-message">{{ message }}</p>
        <div class="flex gap-2.5 justify-end mt-5">
          <BaseButton variant="secondary" @click="$emit('cancel')">Cancel</BaseButton>
          <BaseButton variant="danger" @click="$emit('confirm')">
            {{ confirmLabel ?? 'Confirm' }}
          </BaseButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import BaseButton from './BaseButton.vue'

defineProps<{
  title: string
  message: string
  confirmLabel?: string
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<style scoped>
@reference "tailwindcss";
.dialog-title {
  @apply font-semibold mb-2;
  font-size: 1.1rem;
  color: var(--color-heading);
}

.dialog-message {
  @apply leading-[1.5] mb-1;
  font-size: 0.9rem;
  color: var(--color-muted);
}
</style>
