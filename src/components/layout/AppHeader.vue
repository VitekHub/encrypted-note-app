<template>
  <header class="app-header">
    <h1 class="app-title">
      <img src="/favicon.svg" alt="lock icon" class="w-6 h-6 shrink-0" />
      CipherNote
    </h1>

    <nav v-if="!isMobile" class="nav-links">
      <RouterLink v-if="hasMasterKey" to="/" class="nav-link">Note</RouterLink>
      <RouterLink v-if="hasMasterKey" to="/settings" class="nav-link">Settings</RouterLink>
      <RouterLink v-if="hasMasterKey" to="/about" class="nav-link">About</RouterLink>
      <button v-if="hasMasterKey" class="nav-lock-btn" @click="handleLock">Lock</button>
      <ThemeToggle />
    </nav>

    <div v-else class="flex items-center gap-3">
      <ThemeToggle />
      <button
        v-if="hasMobileMenuItems"
        class="hamburger-btn"
        :aria-expanded="menuOpen"
        aria-label="Toggle menu"
        @click="menuOpen = !menuOpen"
      >
        <span class="hamburger-line" :class="{ open: menuOpen }" />
        <span class="hamburger-line" :class="{ open: menuOpen }" />
        <span class="hamburger-line" :class="{ open: menuOpen }" />
      </button>
    </div>

    <Transition name="mobile-menu">
      <div v-if="isMobile && menuOpen" class="mobile-menu">
        <RouterLink v-if="hasMasterKey" to="/" class="mobile-nav-link" @click="menuOpen = false">Note</RouterLink>
        <RouterLink v-if="hasMasterKey" to="/settings" class="mobile-nav-link" @click="menuOpen = false">
          Settings
        </RouterLink>
        <RouterLink v-if="hasMasterKey" to="/about" class="mobile-nav-link" @click="menuOpen = false">About</RouterLink>
        <button v-if="hasMasterKey" class="mobile-nav-link mobile-lock-btn" @click="handleLockMobile">Lock</button>
      </div>
    </Transition>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionKeys } from '../../composables/useSessionKeys'
import { useSettings } from '../../composables/useSettings'
import { useNoteState } from '../../composables/useNoteState'
import { cryptoService } from '../../utils/crypto/cryptoService'
import ThemeToggle from './ThemeToggle.vue'

const router = useRouter()
const { hasMasterKey, clearMasterKey } = useSessionKeys()
const hasMobileMenuItems = computed(() => hasMasterKey.value)
const { resetSettings } = useSettings()
const { noteText } = useNoteState()

const menuOpen = ref(false)
const isMobile = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 640
  if (!isMobile.value) menuOpen.value = false
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

function handleLock() {
  cryptoService.lock()
  clearMasterKey()
  resetSettings()
  noteText.value = ''
  router.push('/unlock')
}

function handleLockMobile() {
  menuOpen.value = false
  handleLock()
}
</script>

<style scoped>
@reference "tailwindcss";

.app-header {
  @apply flex items-center justify-between mb-6 relative;
}

.app-title {
  @apply flex items-center gap-2 text-2xl font-semibold m-0;
  color: var(--color-heading);
}

.nav-links {
  @apply flex items-center gap-1;
}

.nav-link {
  @apply text-sm font-medium px-3 py-1.5 rounded-lg no-underline transition-colors duration-150;
  color: var(--color-muted);
}

.nav-link:hover {
  color: var(--color-text);
  background-color: var(--color-surface);
}

.nav-link.router-link-active {
  color: var(--color-heading);
  background-color: var(--color-surface);
}

.nav-lock-btn {
  @apply text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer border-none font-[inherit] bg-transparent transition-colors duration-150;
  color: var(--color-muted);
}

.nav-lock-btn:hover {
  color: var(--color-danger);
  background-color: var(--color-surface);
}

.hamburger-btn {
  @apply flex flex-col justify-center items-center gap-[5px] w-8 h-8 cursor-pointer border-none rounded-lg p-1.5 bg-transparent transition-colors duration-150;
}

.hamburger-btn:hover {
  background-color: var(--color-surface);
}

.hamburger-line {
  @apply block w-4 rounded-full transition-all duration-200;
  height: 1.5px;
  background-color: var(--color-text);
}

.hamburger-line.open:nth-child(1) {
  transform: translateY(6.5px) rotate(45deg);
}

.hamburger-line.open:nth-child(2) {
  opacity: 0;
}

.hamburger-line.open:nth-child(3) {
  transform: translateY(-6.5px) rotate(-45deg);
}

.mobile-menu {
  @apply absolute top-full left-0 right-0 z-50 flex flex-col overflow-hidden;
  background-color: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  margin-top: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.mobile-nav-link {
  @apply text-sm font-medium px-4 py-3 no-underline text-left w-full cursor-pointer border-none font-[inherit] bg-transparent transition-colors duration-150;
  color: var(--color-text);
  display: block;
}

.mobile-nav-link:hover {
  background-color: var(--color-bg);
}

.mobile-nav-link.router-link-active {
  color: var(--color-accent);
}

.mobile-lock-btn {
  color: var(--color-danger);
}

.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
