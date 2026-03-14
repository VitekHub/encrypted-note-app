<template>
  <div class="flex flex-col gap-3">
    <h2 class="section-title">Encryption Roadmap</h2>
    <p class="roadmap-intro">Step by step journey toward zero-knowledge encryption.</p>
    <div class="flex flex-col">
      <RoadmapStep
        v-for="(step, idx) in roadmapSteps"
        :key="idx"
        :step="step"
        :step-number="idx + 1"
        :initial-expanded="idx === 0"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import RoadmapStep from './RoadmapStep.vue'
import { roadmapSteps } from '../../data/roadmapSteps'
</script>

<style scoped>
@reference "tailwindcss";
.section-title {
  @apply m-0 text-xs font-semibold tracking-[0.08em] uppercase;
  color: var(--color-info-roadmap);
}

.roadmap-intro {
  @apply mb-2 text-sm leading-[1.6] opacity-70;
  color: var(--color-text);
}
</style>
