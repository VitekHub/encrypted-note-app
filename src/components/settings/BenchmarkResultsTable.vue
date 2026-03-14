<template>
  <div class="benchmark-results">
    <table>
      <thead>
        <tr>
          <th>Memory</th>
          <th>Iter</th>
          <th>Parallel</th>
          <th>Time (ms)</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(res, i) in results" :key="i">
          <td>{{ Math.round(res.params.memorySize / 1024) }} MiB</td>
          <td>{{ res.params.iterations }}</td>
          <td>{{ res.params.parallelism }}</td>
          <td :class="{ 'slow-result': res.durationMs > 2000 }">
            <span v-if="res.durationMs === 0" class="spinner" />
            <span v-else-if="res.durationMs === -1" class="error-text">Out of Mem.</span>
            <span v-else>{{ res.durationMs }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { CalibrationResult } from '../../utils/crypto/cryptoService'

defineProps<{
  results: CalibrationResult[]
}>()
</script>

<style scoped>
@reference "tailwindcss";
.benchmark-results {
  @apply mt-4 overflow-x-auto rounded-md;
  border: 1px solid var(--color-border);

  table {
    @apply w-full border-collapse;
    font-size: 0.8125rem;
  }

  th,
  td {
    @apply text-left;
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-border);
  }

  th {
    @apply font-semibold;
    background: var(--color-bg);
    color: var(--color-muted);
  }

  tr:last-child td {
    border-bottom: none;
  }
}

.slow-result {
  @apply font-semibold;
  color: var(--color-danger);
}
</style>
