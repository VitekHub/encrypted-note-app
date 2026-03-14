<template>
  <div class="theme-toggle" role="group" aria-label="Theme">
    <button
      v-for="option in options"
      :key="option.value"
      class="theme-btn"
      :class="{ active: mode === option.value }"
      :aria-pressed="mode === option.value"
      @click="setMode(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useTheme, type ThemeMode } from '../../composables/useTheme'

const { mode, setMode } = useTheme()

const options: { label: string; value: ThemeMode }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]
</script>

<style scoped>
@reference "tailwindcss";
.theme-toggle {
  @apply inline-flex items-center p-0.5 gap-0.5;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.theme-btn {
  @apply cursor-pointer border-none bg-transparent font-medium font-[inherit] leading-[1.5];
  padding: 4px 12px;
  font-size: 0.75rem;
  border-radius: 6px;
  color: var(--color-muted);
  transition:
    background-color 0.15s,
    color 0.15s;

  &:hover:not(.active) {
    background-color: var(--color-bg);
    color: var(--color-text);
  }

  &.active {
    @apply font-semibold;
    background-color: var(--color-bg);
    color: var(--color-text);
  }
}
</style>
