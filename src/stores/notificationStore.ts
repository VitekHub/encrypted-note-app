import { ref } from 'vue'
import { defineStore } from 'pinia'

export type NotificationType = 'success' | 'error' | 'info'

export interface Notification {
  id: string
  message: string
  type: NotificationType
  timestamp: number
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])

  function showNotification(message: string, type: NotificationType = 'info', duration: number = 3500): string {
    const id = generateId()
    const notification: Notification = {
      id,
      message,
      type,
      timestamp: Date.now(),
    }

    notifications.value.push(notification)

    if (duration > 0) {
      setTimeout(() => {
        clearNotification(id)
      }, duration)
    }

    return id
  }

  function clearNotification(id: string): void {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  return {
    notifications,
    showNotification,
    clearNotification,
  }
})
