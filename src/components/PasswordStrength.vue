<template>
  <div class="strength-indicator">
    <div class="strength-bar">
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
import { getPasswordStrength } from '../utils/passwordPolicy'

const props = defineProps<{
  password: string
}>()

const strength = computed(() => getPasswordStrength(props.password))
</script>

<style scoped>
.strength-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.strength-bar {
  display: flex;
  gap: 4px;
  flex: 1;
}

.strength-segment {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background-color: var(--color-border);
  transition: background-color 0.25s ease;
}

.strength-segment.filled.level-weak { background-color: #ef4444; }
.strength-segment.filled.level-fair { background-color: #f97316; }
.strength-segment.filled.level-good { background-color: #84cc16; }
.strength-segment.filled.level-strong { background-color: #22c55e; }

.strength-label {
  font-size: 0.78rem;
  font-weight: 600;
  min-width: 44px;
  text-align: right;
  transition: color 0.25s ease;
}

.strength-label.level-weak { color: #ef4444; }
.strength-label.level-fair { color: #f97316; }
.strength-label.level-good { color: #84cc16; }
.strength-label.level-strong { color: #22c55e; }
</style>
