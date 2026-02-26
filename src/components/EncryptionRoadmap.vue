<template>
  <div class="encryption-roadmap">
    <h2 class="section-title">Encryption Roadmap</h2>
    <p class="roadmap-intro">Step by step journey toward zero-knowledge encryption.</p>

    <div class="steps-container">
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
import { roadmapSteps } from '../data/roadmapSteps'
</script>

<style lang="scss" scoped>
$color-roadmap: #d68910;

.encryption-roadmap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $color-roadmap;
}

.roadmap-intro {
  margin: 0 0 8px;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-text);
  opacity: 0.7;
}

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}
</style>
