import { computed, ref } from 'vue'

const masterKey = ref<CryptoKey | null>(null)

/**
 * Composable for managing session-only cryptographic keys.
 *
 * The Master Key is generated during sign-up and unwrapped during login,
 * but is never persisted to storage. It lives only in memory for the duration
 * of the user's session, bound to this composable.
 *
 * **Security Notes:**
 * - The key is cleared on lock or session termination
 * - Multiple components can import and use this composable
 * - When the ref is null, no decryption/encryption is possible
 */
export function useSessionKeys() {
  const hasMasterKey = computed(() => masterKey.value !== null)

  function setMasterKey(key: CryptoKey): void {
    masterKey.value = key
  }

  function clearMasterKey(): void {
    masterKey.value = null
  }

  return {
    masterKey,
    hasMasterKey,
    setMasterKey,
    clearMasterKey,
  }
}
