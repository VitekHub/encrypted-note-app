<template>
  <div
    class="notification"
    :class="{
      'notification--success': type === 'success',
      'notification--error': type === 'error',
      'notification--info': type === 'info',
    }"
  >
    <div class="notification-icon">
      <span v-if="type === 'success'">✓</span>
      <span v-else-if="type === 'error'">✕</span>
      <span v-else>ℹ</span>
    </div>
    <div class="notification-message">{{ message }}</div>
    <button class="notification-close" aria-label="Close notification" @click="$emit('close')">×</button>
  </div>
</template>

<script setup lang="ts">
import type { NotificationType } from '../../stores/notificationStore'

defineProps<{
  message: string
  type: NotificationType
}>()

defineEmits<{
  close: []
}>()
</script>

<style scoped>
@reference "tailwindcss";
.notification {
  @apply flex items-center gap-3 rounded-lg max-w-[400px];
  padding: 12px 16px;
  background-color: var(--color-surface);
  border: 1.5px solid var(--color-border);
  box-shadow: 0 4px 12px var(--color-shadow-md);
  animation: slideIn 0.3s ease-out;

  &.notification--success {
    border-color: var(--color-success);
    background-color: var(--color-success-subtle);

    .notification-icon {
      color: var(--color-success);
    }
  }

  &.notification--error {
    border-color: var(--color-danger);
    background-color: var(--color-danger-subtle);

    .notification-icon {
      color: var(--color-danger);
    }
  }

  &.notification--info {
    border-color: var(--color-accent);
    background-color: var(--color-accent-subtle);

    .notification-icon {
      color: var(--color-accent);
    }
  }
}

.notification-icon {
  @apply shrink-0 flex items-center justify-center w-5 h-5 font-semibold;
  font-size: 0.9rem;
}

.notification-message {
  @apply flex-1 leading-[1.4];
  font-size: 0.9rem;
  color: var(--color-text);
}

.notification-close {
  @apply shrink-0 flex items-center justify-center w-6 h-6 p-0 bg-none border-none cursor-pointer;
  font-size: 1.2rem;
  background: none;
  border: none;
  color: var(--color-muted);
  transition: color 0.15s;

  &:hover {
    color: var(--color-text);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
