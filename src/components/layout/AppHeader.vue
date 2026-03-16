<template>
  <header class="app-header">
    <h1 class="app-title">
      <img src="/favicon.svg" alt="CipherNote logo" class="w-6 h-6 shrink-0" />
      CipherNote
    </h1>

    <nav v-if="!isMobile" class="nav-links">
      <RouterLink v-if="isAuthenticated" to="/" class="nav-link">Note</RouterLink>
      <RouterLink v-if="isAuthenticated" to="/settings" class="nav-link">Settings</RouterLink>
      <RouterLink v-if="isAuthenticated" to="/about" class="nav-link">About</RouterLink>

      <div v-if="isAuthenticated" class="user-menu-wrapper" ref="userMenuRef">
        <button class="user-menu-trigger" :aria-expanded="userMenuOpen" @click="userMenuOpen = !userMenuOpen">
          <span class="user-menu-username">{{ username }}</span>
          <svg
            class="user-menu-chevron"
            :class="{ open: userMenuOpen }"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <Transition name="user-menu">
          <div v-if="userMenuOpen" class="user-dropdown">
            <span class="user-dropdown-label">{{ username }}</span>
            <div class="user-dropdown-divider" />
            <button class="user-dropdown-item lock-item" @click="handleLockMenu">Lock</button>
            <button class="user-dropdown-item signout-item" @click="handleSignOutMenu">Sign Out</button>
          </div>
        </Transition>
      </div>

      <ThemeToggle />
    </nav>

    <div v-else class="flex items-center gap-3">
      <ThemeToggle />
      <button
        v-if="isAuthenticated"
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
        <span v-if="isAuthenticated && username" class="mobile-username">{{ username }}</span>
        <RouterLink v-if="isAuthenticated" to="/" class="mobile-nav-link" @click="menuOpen = false">Note</RouterLink>
        <RouterLink v-if="isAuthenticated" to="/settings" class="mobile-nav-link" @click="menuOpen = false">
          Settings
        </RouterLink>
        <RouterLink v-if="isAuthenticated" to="/about" class="mobile-nav-link" @click="menuOpen = false">
          About
        </RouterLink>
        <button v-if="isAuthenticated" class="mobile-nav-link mobile-lock-btn" @click="handleLockMobile">Lock</button>
        <button v-if="isAuthenticated" class="mobile-nav-link mobile-signout-btn" @click="handleSignOutMobile">
          Sign Out
        </button>
      </div>
    </Transition>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore'
import { storeToRefs } from 'pinia'
import ThemeToggle from './ThemeToggle.vue'

const router = useRouter()
const authStore = useAuthStore()
const { isAuthenticated, username } = storeToRefs(authStore)

const menuOpen = ref(false)
const userMenuOpen = ref(false)
const isMobile = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)

function checkMobile() {
  isMobile.value = window.innerWidth < 640
  if (!isMobile.value) menuOpen.value = false
}

function handleOutsideClick(event: MouseEvent) {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
    userMenuOpen.value = false
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('mousedown', handleOutsideClick)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('mousedown', handleOutsideClick)
})

async function handleLock() {
  await authStore.lock()
  router.push('/unlock')
}

async function handleLockMobile() {
  menuOpen.value = false
  await handleLock()
}

async function handleLockMenu() {
  userMenuOpen.value = false
  await handleLock()
}

async function handleSignOut() {
  await authStore.logout()
  router.push('/login')
}

async function handleSignOutMobile() {
  menuOpen.value = false
  await handleSignOut()
}

async function handleSignOutMenu() {
  userMenuOpen.value = false
  await handleSignOut()
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

  & .nav-link {
    @apply text-sm font-medium px-3 py-1.5 rounded-lg no-underline transition-colors duration-150;
    color: var(--color-muted);

    &:hover {
      color: var(--color-text);
      background-color: var(--color-surface);
    }

    &.router-link-active {
      color: var(--color-heading);
      background-color: var(--color-surface);
    }
  }
}

.user-menu-wrapper {
  @apply relative;

  & .user-menu-trigger {
    @apply flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer border-none font-[inherit] bg-transparent transition-colors duration-150;
    color: var(--color-muted);

    &:hover {
      color: var(--color-text);
      background-color: var(--color-surface);
    }

    & .user-menu-username {
      @apply leading-none;
    }

    & .user-menu-chevron {
      @apply transition-transform duration-150;
      color: currentColor;
      opacity: 0.6;

      &.open {
        transform: rotate(180deg);
      }
    }
  }

  & .user-dropdown {
    @apply absolute right-0 z-50 flex flex-col overflow-hidden min-w-[140px];
    top: calc(100% + 6px);
    background-color: var(--color-surface);
    border: 1.5px solid var(--color-border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);

    & .user-dropdown-label {
      @apply text-xs font-medium px-4 py-2.5;
      color: var(--color-muted);
      opacity: 0.7;
    }

    & .user-dropdown-divider {
      height: 1px;
      background-color: var(--color-border);
    }

    & .user-dropdown-item {
      @apply text-sm font-medium px-4 py-2.5 text-left w-full cursor-pointer border-none font-[inherit] bg-transparent transition-colors duration-150;
      color: var(--color-text);
      display: block;

      &:hover {
        background-color: var(--color-bg);
      }

      &.lock-item {
        color: var(--color-danger);
      }

      &.signout-item {
        color: var(--color-muted);
      }
    }
  }
}

.user-menu-enter-active,
.user-menu-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.user-menu-enter-from,
.user-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.hamburger-btn {
  @apply flex flex-col justify-center items-center gap-[5px] w-8 h-8 cursor-pointer border-none rounded-lg p-1.5 bg-transparent transition-colors duration-150;

  &:hover {
    background-color: var(--color-surface);
  }

  & .hamburger-line {
    @apply block w-4 rounded-full transition-all duration-200;
    height: 1.5px;
    background-color: var(--color-text);

    &.open:nth-child(1) {
      transform: translateY(6.5px) rotate(45deg);
    }

    &.open:nth-child(2) {
      opacity: 0;
    }

    &.open:nth-child(3) {
      transform: translateY(-6.5px) rotate(-45deg);
    }
  }
}

.mobile-menu {
  @apply absolute top-full left-0 right-0 z-50 flex flex-col overflow-hidden;
  background-color: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  margin-top: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);

  & .mobile-username {
    @apply text-xs font-medium px-4 py-2;
    color: var(--color-muted);
    opacity: 0.7;
    border-bottom: 1px solid var(--color-border);
  }

  & .mobile-nav-link {
    @apply text-sm font-medium px-4 py-3 no-underline text-left w-full cursor-pointer border-none font-[inherit] bg-transparent transition-colors duration-150;
    color: var(--color-text);
    display: block;

    &:hover {
      background-color: var(--color-bg);
    }

    &.router-link-active {
      color: var(--color-accent);
    }

    &.mobile-lock-btn {
      color: var(--color-danger);
    }

    &.mobile-signout-btn {
      color: var(--color-muted);
    }
  }
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
