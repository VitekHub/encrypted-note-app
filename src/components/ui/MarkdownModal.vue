<template>
  <Teleport to="body">
    <div class="md-overlay" @click.self="close">
      <div class="md-card" role="dialog" aria-modal="true">
        <div class="md-header">
          <h2 class="md-title">{{ title }}</h2>
          <button class="md-close" aria-label="Close" @click="close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div class="md-body">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="md-content" v-html="renderedContent" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps<{
  title: string
  content: string
}>()

const emit = defineEmits<{
  close: []
}>()

const renderedContent = computed(() => DOMPurify.sanitize(marked(props.content) as string))

function close() {
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
@reference "tailwindcss";

.md-overlay {
  @apply fixed inset-0 flex items-center justify-center z-50;
  background-color: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  animation: fadeIn 0.15s ease;
  padding: 16px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.md-card {
  @apply flex flex-col w-full overflow-hidden rounded-xl;
  max-width: 960px;
  max-height: 88vh;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  animation: slideUp 0.2s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.md-header {
  @apply flex items-center justify-between shrink-0;
  padding: 18px 24px 16px;
  border-bottom: 1px solid var(--color-border);
}

.md-title {
  @apply m-0 font-semibold text-base leading-snug;
  color: var(--color-heading);
}

.md-close {
  @apply flex items-center justify-center shrink-0 bg-transparent border-none cursor-pointer rounded-md opacity-60;
  width: 32px;
  height: 32px;
  color: var(--color-text);
  transition:
    opacity 0.15s,
    background-color 0.15s;

  &:hover {
    @apply opacity-100;
    background-color: var(--color-surface);
  }
}

.md-body {
  @apply flex-1 overflow-y-auto;
  padding: 24px 28px;
}

.md-content {
  @apply text-sm leading-relaxed;
  color: var(--color-text);
}

:deep(h1) {
  @apply text-xl font-semibold mt-0 mb-5;
  color: var(--color-heading);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 10px;
}

:deep(h2) {
  @apply text-base font-semibold mt-8 mb-3;
  color: var(--color-heading);
}

:deep(h3) {
  @apply text-sm font-semibold mt-6 mb-2;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

:deep(h4) {
  @apply text-sm font-semibold mt-4 mb-2;
  color: var(--color-heading);
}

:deep(p) {
  @apply mt-0 mb-4 leading-relaxed opacity-85;
}

:deep(ul) {
  @apply mt-0 mb-4 pl-5 list-disc;
}
:deep(ol) {
  @apply mt-0 mb-4 pl-5 list-decimal;
}

:deep(li) {
  @apply mb-1.5 leading-relaxed opacity-85;
}

:deep(code) {
  @apply font-mono text-xs px-1.5 py-0.5 rounded;
  background-color: var(--color-surface);
  color: var(--color-accent);
  border: 1px solid var(--color-border);
}

:deep(pre) {
  @apply rounded-lg overflow-x-auto mb-4;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 14px 18px;
}

:deep(pre code) {
  @apply px-0 py-0 border-none bg-transparent text-xs leading-relaxed;
  color: var(--color-text);
}

:deep(blockquote) {
  @apply m-0 mb-4 pl-4 italic opacity-75;
  border-left: 3px solid var(--color-accent);
  color: var(--color-text);
}

:deep(hr) {
  @apply my-6;
  border: none;
  border-top: 1px solid var(--color-border);
}

:deep(strong) {
  @apply font-semibold opacity-100;
  color: var(--color-heading);
}

:deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
  opacity: 0.9;
}

:deep(a:hover) {
  opacity: 1;
}

:deep(table) {
  @apply w-full text-sm mb-4 border-collapse;
}

:deep(thead) {
  background-color: var(--color-surface);
}

:deep(th) {
  @apply text-left font-semibold px-3 py-2 text-xs;
  color: var(--color-heading);
  border: 1px solid var(--color-border);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

:deep(td) {
  @apply px-3 py-2 leading-relaxed;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  opacity: 0.85;
}
</style>
