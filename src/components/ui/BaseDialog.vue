<template>
  <Teleport to="body">
    <div class="dialog-overlay" @click.self="$emit('close')">
      <div class="dialog-card">
        <h3 v-if="title" class="dialog-title">{{ title }}</h3>
        <p v-if="description" class="muted-text mb-5">{{ description }}</p>
        <slot />
        <div v-if="$slots.actions" class="dialog-footer">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()

defineEmits<{
  close: []
}>()
</script>

<style scoped>
@reference "tailwindcss";
.dialog-title {
  @apply text-lg font-semibold mb-4;
  color: var(--color-heading);
}

.dialog-footer {
  @apply flex gap-3 justify-end mt-6 pt-4;
  border-top: 1px solid var(--color-border);
}
</style>
