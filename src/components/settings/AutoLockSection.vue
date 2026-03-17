<template>
  <div class="section-card">
    <h3 class="section-heading">Auto-Lock</h3>
    <p class="muted-text mb-4">Automatically lock your session and clear memory after a period of inactivity.</p>
    <div class="max-w-[200px]">
      <BaseSelect v-model="idleTimeoutMinutes" :options="timeoutOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '../../stores/settingsStore'
import BaseSelect from '../ui/BaseSelect.vue'

const settingsStore = useSettingsStore()
const { settings } = storeToRefs(settingsStore)

const idleTimeoutMinutes = computed({
  get: () => settings.value.idleTimeoutMinutes,
  set: (val: number) => settingsStore.setIdleTimeoutMinutes(val),
})

const timeoutOptions = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 0, label: 'Never' },
]
</script>
