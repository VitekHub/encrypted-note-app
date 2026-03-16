<template>
  <div class="roadmap-step">
    <button class="step-header" @click="isExpanded = !isExpanded">
      <span class="step-number">Step {{ stepNumber }}</span>
      <span class="step-title">{{ step.title }}</span>
      <span v-if="stepNumber <= 12">✅</span>
      <span class="chevron" :class="{ expanded: isExpanded }">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 5L10 9L6 13"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </button>

    <div v-if="isExpanded" class="step-content">
      <div class="content-section">
        <h4 class="section-label">Goal</h4>
        <p class="section-text">{{ step.goal }}</p>
      </div>

      <div v-for="section in sections(step)" :key="section.key" class="content-section">
        <h4 class="section-label">{{ section.label }}</h4>
        <ul class="list-none m-0 p-0 flex flex-col gap-2">
          <li v-for="(item, idx) in section.items" :key="idx" class="point-item">{{ item }}</li>
        </ul>
      </div>

      <div v-if="!step.flow.length && !step.securityGain.length && !step.dangers.length" class="content-section">
        <p class="placeholder-text">Coming soon...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { RoadmapStep as RoadmapStepType } from '../../data/roadmapSteps'

interface Props {
  step: RoadmapStepType
  stepNumber: number
  initialExpanded?: boolean
}

withDefaults(defineProps<Props>(), {
  initialExpanded: false,
})

const isExpanded = ref(false)

const sections = (step: RoadmapStepType) => [
  { key: 'flow', label: 'Resulting Flow', items: step.flow || [] },
  { key: 'securityGain', label: 'Security Gain', items: step.securityGain || [] },
  { key: 'dangers', label: 'Danger of Stopping Here', items: step.dangers || [] },
]
</script>

<style scoped>
@reference "tailwindcss";
.roadmap-step {
  @apply mb-3 overflow-hidden rounded-md;
  border: 1px solid var(--color-border);
  transition:
    border-color 0.2s,
    opacity 0.2s;

  &:hover {
    border-color: var(--color-text);
    opacity: 0.95;
  }
}

.step-header {
  @apply flex items-center gap-3 w-full bg-transparent border-none cursor-pointer text-left;
  padding: 14px 16px;
  font-size: 0.875rem;
  color: var(--color-text);
  transition: background-color 0.2s;
}

.step-number {
  @apply shrink-0 font-semibold tracking-[0.05em] opacity-90;
  font-size: 0.8rem;
  color: var(--color-accent);
}

.step-title {
  @apply flex-1 font-medium;
  color: var(--color-text);
}

.chevron {
  @apply shrink-0 flex items-center justify-center w-5 h-5 opacity-60;
  color: var(--color-text);
  transition:
    transform 0.3s,
    opacity 0.2s;

  &.expanded {
    @apply rotate-90 opacity-100;
  }
}

.step-content {
  @apply p-4;
  border-top: 1px solid var(--color-border);
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.content-section {
  @apply mb-4;

  &:last-child {
    @apply mb-0;
  }
}

.section-label {
  @apply mb-2 text-xs font-semibold tracking-[0.08em] uppercase opacity-[0.85];
  color: var(--color-accent);
}

.section-text {
  @apply m-0 text-sm leading-[1.6] opacity-80;
  color: var(--color-text);
}

.point-item {
  @apply text-sm leading-[1.6] opacity-80 pl-4 relative;
  color: var(--color-text);

  &::before {
    content: '•';
    @apply absolute left-1 opacity-60;
    color: var(--color-accent);
  }
}

.placeholder-text {
  @apply m-0 text-sm leading-[1.6] opacity-50 italic;
  color: var(--color-text);
}
</style>
