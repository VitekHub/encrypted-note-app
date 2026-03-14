<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" class="form-label" :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      :ref="inputRef"
      class="input-field"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      v-bind="$attrs"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="error" class="error-text mt-1">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    type?: string
    placeholder?: string
    required?: boolean
    error?: string
    inputRef?: string
  }>(),
  {
    modelValue: '',
    label: '',
    type: 'text',
    placeholder: '',
    required: false,
    error: '',
    inputRef: '',
  }
)

defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputId = computed(() => (props.label ? props.label.toLowerCase().replace(/\s+/g, '-') : undefined))
</script>
