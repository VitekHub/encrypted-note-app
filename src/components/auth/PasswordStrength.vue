<template>
  <div class="flex items-center gap-2.5">
    <div class="flex gap-1 flex-1">
      <div
        v-for="i in 4"
        :key="i"
        class="strength-segment"
        :class="{ filled: i <= strength.score, [`level-${strength.level}`]: i <= strength.score }"
      />
    </div>
    <span class="strength-label" :class="`level-${strength.level}`">
      {{ strength.label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getPasswordStrength } from '../../utils/auth/passwordPolicy'

const props = defineProps<{
  password: string
}>()

const strength = computed(() => getPasswordStrength(props.password))
</script>

<style scoped>
@reference "tailwindcss";

.level-weak {
  --strength-color: var(--color-strength-weak);
}
.level-fair {
  --strength-color: var(--color-strength-fair);
}
.level-good {
  --strength-color: var(--color-strength-good);
}
.level-strong {
  --strength-color: var(--color-strength-strong);
}

.strength-segment {
  @apply flex-1 h-1 rounded-sm;
  background-color: var(--color-border);
  transition: background-color 0.25s ease;

  &.filled {
    background-color: var(--strength-color);
  }
}

.strength-label {
  @apply font-semibold text-right min-w-[44px];
  font-size: 0.78rem;
  color: var(--strength-color);
  transition: color 0.25s ease;
}
</style>
