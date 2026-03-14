<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" class="form-label" :for="selectId">{{ label }}</label>
    <div class="select-wrapper">
      <select
        :id="selectId"
        class="select-field"
        :value="modelValue"
        v-bind="$attrs"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in options" :key="String(opt.value)" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <svg class="select-arrow" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M1 1L6 7L11 1"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue?: string | number
  label?: string
  options: { value: string | number; label: string }[]
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectId = computed(() => (props.label ? props.label.toLowerCase().replace(/\s+/g, '-') : undefined))
</script>
