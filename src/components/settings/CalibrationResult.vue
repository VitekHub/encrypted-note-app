<template>
  <div class="calibration-result">
    <p class="mb-2"><strong>Calibration Result:</strong></p>
    <p class="muted-text mb-2">Target time (0.8-2s) met on this device with:</p>
    <ul class="result-list">
      <li>Memory: {{ Math.round(result.params.memorySize / 1024) }} MiB</li>
      <li>Iterations: {{ result.params.iterations }}</li>
      <li>Parallelism: {{ result.params.parallelism }}</li>
      <li>Estimated time: {{ (result.durationMs / 1000).toFixed(2) }}s</li>
    </ul>
    <BaseButton size="sm" :disabled="applying" @click="$emit('apply')">Apply & Strengthen Key Wrapper</BaseButton>
  </div>
</template>

<script setup lang="ts">
import type { CalibrationResult } from '../../utils/crypto/cryptoService'
import BaseButton from '../ui/BaseButton.vue'

defineProps<{
  result: CalibrationResult
  applying: boolean
}>()

defineEmits<{
  apply: []
}>()
</script>

<style scoped>
@reference "tailwindcss";
.calibration-result {
  @apply mt-5 p-4 rounded-lg;
  background: var(--color-accent-subtle-light);
  border: 1px dashed var(--color-accent);
}

.result-list {
  @apply list-none p-0 mb-4 text-sm flex flex-col gap-1;

  li {
    @apply pl-4 relative;
    color: var(--color-text);

    &::before {
      content: '•';
      @apply absolute left-0;
      color: var(--color-accent);
    }
  }
}
</style>
