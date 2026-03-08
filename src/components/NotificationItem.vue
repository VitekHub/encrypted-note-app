<template>
  <div class="notification" :class="`notification--${type}`">
    <div class="notification-icon">
      <span v-if="type === 'success'" class="icon">✓</span>
      <span v-else-if="type === 'error'" class="icon">✕</span>
      <span v-else class="icon">ℹ</span>
    </div>
    <div class="notification-message">{{ message }}</div>
    <button class="notification-close" aria-label="Close notification" @click="$emit('close')">×</button>
  </div>
</template>

<script setup lang="ts">
import type { NotificationType } from '../composables/useNotification'

defineProps<{
  message: string
  type: NotificationType
}>()

defineEmits<{
  close: []
}>()
</script>

<style lang="scss" scoped>
.notification {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: var(--color-surface);
  border: 1.5px solid var(--color-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease-out;
  max-width: 400px;

  &--success {
    border-color: #10b981;
    background-color: rgba(16, 185, 129, 0.05);

    .notification-icon {
      color: #10b981;
    }
  }

  &--error {
    border-color: #dc2626;
    background-color: rgba(220, 38, 38, 0.05);

    .notification-icon {
      color: #dc2626;
    }
  }

  &--info {
    border-color: var(--color-accent);
    background-color: rgba(59, 130, 246, 0.05);

    .notification-icon {
      color: var(--color-accent);
    }
  }
}

.notification-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-weight: 600;
  font-size: 0.9rem;
}

.notification-message {
  flex: 1;
  font-size: 0.9rem;
  color: var(--color-text);
  line-height: 1.4;
}

.notification-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 1.2rem;
  background: none;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
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

@keyframes slideOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }

  to {
    opacity: 0;
    transform: translateX(100%);
  }
}

.notification.removing {
  animation: slideOut 0.3s ease-in;
}
</style>
