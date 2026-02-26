<template>
  <div class="roadmap-step">
    <button class="step-header" @click="isExpanded = !isExpanded">
      <span class="step-number">Step {{ stepNumber }}</span>
      <span class="step-title">{{ step.title }}</span>
      <span v-if="stepNumber <= 1">
        ✅
      </span>
      <span class="chevron" :class="{ expanded: isExpanded }">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 5L10 9L6 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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
        <ul class="points-list">
          <li v-for="(item, idx) in section.items" :key="idx" class="point-item">
            {{ item }}
          </li>
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
import type { RoadmapStep as RoadmapStepType } from '../data/roadmapSteps'

interface Props {
  step: RoadmapStepType
  stepNumber: number
  initialExpanded?: boolean
}

withDefaults(defineProps<Props>(), {
  initialExpanded: false
})

const isExpanded = ref(false)

const sections = (step: RoadmapStepType) => [
  { key: 'flow', label: 'Resulting Flow', items: step.flow || [] },
  { key: 'securityGain', label: 'Security Gain', items: step.securityGain || [] },
  { key: 'dangers', label: 'Danger of Stopping Here', items: step.dangers || [] },
]
</script>

<style lang="scss" scoped>
.roadmap-step {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-text);
    border-color: var(--color-text);
    opacity: 0.95;
  }
}

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--color-text);
  text-align: left;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--color-bg-secondary);
  }
}

.step-number {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  color: var(--color-accent);
  opacity: 0.9;
}

.step-title {
  flex: 1;
  font-weight: 500;
  color: var(--color-text);
}

.chevron {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--color-text);
  opacity: 0.6;
  transition: transform 0.3s ease, opacity 0.2s ease;

  &.expanded {
    transform: rotate(90deg);
    opacity: 1;
  }
}

.step-content {
  padding: 16px;
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
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-label {
  margin: 0 0 8px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
  opacity: 0.85;
}

.section-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-text);
  opacity: 0.8;
}

.points-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.point-item {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-text);
  opacity: 0.8;
  padding-left: 16px;
  position: relative;

  &::before {
    content: '•';
    position: absolute;
    left: 4px;
    color: var(--color-accent);
    opacity: 0.6;
  }
}

.placeholder-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-text);
  opacity: 0.5;
  font-style: italic;
}
</style>
