<template>
  <Teleport to="body">
    <div class="dialog-backdrop" @click.self="$emit('cancel')">
      <div class="dialog">
        <h2 class="dialog-title">{{ title }}</h2>
        <p class="dialog-message">{{ message }}</p>
        <div class="dialog-actions">
          <button class="btn-secondary" @click="$emit('cancel')">Cancel</button>
          <button class="btn-danger" @click="$emit('confirm')">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
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
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
}

.dialog {
  background-color: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  padding: 28px 32px;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-heading);
}

.dialog-message {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-muted);
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 8px;
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

.btn-danger {
  padding: 9px 18px;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  color: #fff;
  background-color: #dc2626;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-danger:hover {
  opacity: 0.88;
}
</style>
