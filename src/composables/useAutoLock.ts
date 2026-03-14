import { onMounted, onUnmounted, watch } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'

export function useAutoLock(onLock: () => void) {
  const settingsStore = useSettingsStore()
  let timeoutId: number | null = null

  function locked() {
    onLock()
  }

  function resetTimer() {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }

    const minutes = settingsStore.settings.idleTimeoutMinutes
    if (minutes <= 0) return // 0 means Never

    timeoutId = window.setTimeout(locked, minutes * 60 * 1000)
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      locked()
    }
  }

  function handleBeforeUnload() {
    locked()
  }

  onMounted(() => {
    resetTimer()
    // Listen for user activity
    window.addEventListener('mousemove', resetTimer)
    window.addEventListener('keydown', resetTimer)
    window.addEventListener('click', resetTimer)
    window.addEventListener('scroll', resetTimer)

    // Listen for tab/window close or hide
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onUnmounted(() => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }
    window.removeEventListener('mousemove', resetTimer)
    window.removeEventListener('keydown', resetTimer)
    window.removeEventListener('click', resetTimer)
    window.removeEventListener('scroll', resetTimer)

    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })

  // Whenever the timeout setting changes, recalculate the timer
  watch(
    () => settingsStore.settings.idleTimeoutMinutes,
    () => resetTimer()
  )

  return { resetTimer }
}
