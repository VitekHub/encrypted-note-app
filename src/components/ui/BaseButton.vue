<template>
  <button :class="['btn-base', variantClass, sizeClass]" :disabled="disabled || loading" v-bind="$attrs">
    <span v-if="loading" class="spinner" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger'
    size?: 'sm' | 'md'
    disabled?: boolean
    loading?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
  }
)

const variantClass = computed(() => `btn-${props.variant}`)
const sizeClass = computed(() => (props.size === 'sm' ? 'btn-sm' : ''))
</script>
