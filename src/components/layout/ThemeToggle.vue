<template>
  <button class="theme-cycle-btn" :aria-label="`Theme: ${mode}`" @click="cycleMode">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <template v-if="mode === 'system'">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </template>
      <template v-else-if="mode === 'light'">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </template>
      <template v-else>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </template>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { useTheme, type ThemeMode } from '../../composables/useTheme'

const { mode, setMode } = useTheme()

const order: ThemeMode[] = ['system', 'light', 'dark']

function cycleMode() {
  const idx = order.indexOf(mode.value)
  setMode(order[(idx + 1) % order.length])
}
</script>

<style scoped>
@reference "tailwindcss";

.theme-cycle-btn {
  @apply flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent transition-colors duration-150;
  color: var(--color-muted);

  &:hover {
    background-color: var(--color-surface);
    color: var(--color-text);
  }
}
</style>
