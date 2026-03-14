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
import { storeToRefs } from 'pinia'
import { useNotificationStore } from '../../stores/notificationStore'
import NotificationItem from './NotificationItem.vue'

const notificationStore = useNotificationStore()
const { notifications } = storeToRefs(notificationStore)
const { clearNotification } = notificationStore
</script>

<style scoped>
@reference "tailwindcss";
.notification-container {
  @apply fixed flex flex-col pointer-events-none max-w-full z-[1000];
  top: 24px;
  right: 24px;
  gap: 10px;
  padding: 0 16px;

  & > * {
    @apply pointer-events-auto;
  }

  @media (max-width: 640px) {
    top: 16px;
    right: 16px;
    left: 16px;
    padding: 0;
  }
}

.notification-list-enter-active,
.notification-list-leave-active {
  transition: all 0.3s ease;
}

.notification-list-enter-from,
.notification-list-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-list-move {
  transition: transform 0.3s ease;
}
</style>
