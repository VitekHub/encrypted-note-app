// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationStore } from './notificationStore'

describe('notificationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('showNotification', () => {
    it('adds a notification with correct shape', () => {
      const store = useNotificationStore()
      const id = store.showNotification('Hello', 'success', 0)

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0]).toMatchObject({
        id,
        message: 'Hello',
        type: 'success',
      })
      expect(typeof store.notifications[0].timestamp).toBe('number')
    })

    it('defaults type to info when omitted', () => {
      const store = useNotificationStore()
      store.showNotification('Info message', undefined, 0)
      expect(store.notifications[0].type).toBe('info')
    })

    it('returns a unique id', () => {
      const store = useNotificationStore()
      const id1 = store.showNotification('A', 'info', 0)
      const id2 = store.showNotification('B', 'info', 0)
      expect(id1).not.toBe(id2)
    })

    it('auto-dismisses after the specified duration', () => {
      const store = useNotificationStore()
      store.showNotification('Auto', 'info', 1000)
      expect(store.notifications).toHaveLength(1)

      vi.advanceTimersByTime(999)
      expect(store.notifications).toHaveLength(1)

      vi.advanceTimersByTime(1)
      expect(store.notifications).toHaveLength(0)
    })

    it('does not auto-dismiss when duration is 0', () => {
      const store = useNotificationStore()
      store.showNotification('Persistent', 'error', 0)

      vi.advanceTimersByTime(60_000)
      expect(store.notifications).toHaveLength(1)
    })

    it('can hold multiple notifications', () => {
      const store = useNotificationStore()
      store.showNotification('A', 'info', 0)
      store.showNotification('B', 'error', 0)
      store.showNotification('C', 'success', 0)
      expect(store.notifications).toHaveLength(3)
    })
  })

  describe('clearNotification', () => {
    it('removes only the notification with the matching id', () => {
      const store = useNotificationStore()
      const id1 = store.showNotification('A', 'info', 0)
      const id2 = store.showNotification('B', 'error', 0)

      store.clearNotification(id1)

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].id).toBe(id2)
    })

    it('does nothing when the id does not exist', () => {
      const store = useNotificationStore()
      store.showNotification('A', 'info', 0)
      store.clearNotification('nonexistent-id')
      expect(store.notifications).toHaveLength(1)
    })
  })
})
