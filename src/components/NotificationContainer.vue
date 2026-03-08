<template>
  <Teleport to="body">
    <div class="notification-container">
      <TransitionGroup name="notification-list" tag="div">
        <NotificationItem
          v-for="notification in notifications"
          :key="notification.id"
          :message="notification.message"
          :type="notification.type"
          @close="clearNotification(notification.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useNotification } from '../composables/useNotification'
import NotificationItem from './NotificationItem.vue'

const { notifications, clearNotification } = useNotification()
</script>

<style lang="scss" scoped>
.notification-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
  max-width: 100%;
  padding: 0 16px;

  > * {
    pointer-events: auto;
  }

  @media (max-width: 640px) {
    top: 16px;
    right: 16px;
    left: 16px;
    padding: 0;

    > * {
      max-width: 100%;
    }
  }
}

.notification-list-enter-active,
.notification-list-leave-active {
  transition: all 0.3s ease;
}

.notification-list-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-list-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-list-move {
  transition: transform 0.3s ease;
}
</style>
