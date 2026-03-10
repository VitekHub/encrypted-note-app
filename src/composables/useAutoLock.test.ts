import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAutoLock } from './useAutoLock'
import { useSettings } from './useSettings'

let unmountedCb: Function | null = null
vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    onMounted: (fn: Function) => fn(),
    onUnmounted: (fn: Function) => {
      unmountedCb = fn
    },
  }
})

vi.mock('./useSettings', () => {
  const settings = { value: { idleTimeoutMinutes: 5 } }
  return {
    useSettings: () => ({ settings }),
  }
})

describe('useAutoLock', () => {
  let listeners: Record<string, Function[]> = {}

  beforeEach(() => {
    vi.useFakeTimers()
    listeners = {}

    const addListener = (event: string, fn: Function) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(fn)
    }
    const removeListener = (event: string, fn: Function) => {
      if (!listeners[event]) return
      listeners[event] = listeners[event].filter((f) => f !== fn)
    }
    const dispatch = (event: Event) => {
      if (listeners[event.type]) {
        listeners[event.type].forEach((fn) => fn(event))
      }
    }

    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      addEventListener: addListener,
      removeEventListener: removeListener,
      dispatchEvent: dispatch,
    })

    vi.stubGlobal('document', {
      addEventListener: addListener,
      removeEventListener: removeListener,
      dispatchEvent: dispatch,
      visibilityState: 'visible',
    })

    if (typeof Event === 'undefined') {
      vi.stubGlobal(
        'Event',
        class Event {
          type: string
          constructor(type: string) {
            this.type = type
          }
        }
      )
    }
  })

  afterEach(() => {
    if (unmountedCb) {
      unmountedCb()
      unmountedCb = null
    }
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('calls onLock after the specified timeout', () => {
    const onLock = vi.fn()
    useAutoLock(onLock)

    // Should not be locked immediately
    expect(onLock).not.toHaveBeenCalled()

    // Fast-forward time to just before 5 minutes
    vi.advanceTimersByTime(4.9 * 60 * 1000)
    expect(onLock).not.toHaveBeenCalled()

    // Fast-forward past 5 minutes
    vi.advanceTimersByTime(0.2 * 60 * 1000)
    expect(onLock).toHaveBeenCalledOnce()
  })

  it('resets the timer on user activity', () => {
    const onLock = vi.fn()
    useAutoLock(onLock)

    vi.advanceTimersByTime(4 * 60 * 1000)

    // Simulate user activity
    window.dispatchEvent(new Event('mousemove'))

    // Fast forward another 4 minutes. Total time is 8 minutes, but since it was reset at 4m,
    // it shouldn't trigger until 4m + 5m = 9m.
    vi.advanceTimersByTime(4 * 60 * 1000)
    expect(onLock).not.toHaveBeenCalled()

    // Now advance past 9m total time
    vi.advanceTimersByTime(1.1 * 60 * 1000)
    expect(onLock).toHaveBeenCalledOnce()
  })

  it('locks immediately on visibilitychange to hidden', () => {
    const onLock = vi.fn()
    useAutoLock(onLock)

    // Mock document visibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis.document as any).visibilityState = 'hidden'

    globalThis.document.dispatchEvent(new Event('visibilitychange'))
    expect(onLock).toHaveBeenCalledOnce()
  })

  it('does not lock if idleTimeoutMinutes is 0', () => {
    const { settings } = useSettings()
    settings.value.idleTimeoutMinutes = 0

    const onLock = vi.fn()
    useAutoLock(onLock)

    vi.advanceTimersByTime(60 * 60 * 1000) // 1 hour
    expect(onLock).not.toHaveBeenCalled()

    // Reset back to 5 for other tests
    settings.value.idleTimeoutMinutes = 5
  })
})
