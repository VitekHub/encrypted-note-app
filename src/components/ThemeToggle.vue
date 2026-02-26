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
import { useTheme, type ThemeMode } from '../composables/useTheme'

const { mode, setMode } = useTheme()

const options: { label: string; value: ThemeMode }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]
</script>

<style lang="scss" scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.theme-btn {
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: inherit;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  line-height: 1.5;

  &:hover:not(.active) {
    background-color: var(--color-bg);
    color: var(--color-text);
  }

  &.active {
    background-color: var(--color-bg);
    color: var(--color-text);
    font-weight: 600;
  }
}
</style>
