<template>
  <header class="flex items-center justify-between mb-6">
    <h1 class="app-title">
      <img src="/favicon.svg" alt="lock icon" class="w-6 h-6 shrink-0" />
      CipherNote
    </h1>
    <ThemeToggle />
  </header>
</template>

<script setup lang="ts">
import ThemeToggle from './ThemeToggle.vue'
</script>

<style scoped>
@reference "tailwindcss";
.app-title {
  @apply flex items-center gap-2 text-2xl font-semibold m-0;
  color: var(--color-heading);
}
</style>
