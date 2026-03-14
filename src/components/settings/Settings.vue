<template>
  <div class="settings">
    <h2 class="settings-title">Security Settings</h2>
    <AutoLockSection />
    <ChangePasswordSection />
    <KeyRotationSection />
    <Argon2Section />
  </div>
</template>

<script setup lang="ts">
import AutoLockSection from './AutoLockSection.vue'
import ChangePasswordSection from './ChangePasswordSection.vue'
import KeyRotationSection from './KeyRotationSection.vue'
import Argon2Section from './Argon2Section.vue'
</script>

<style scoped>
@reference "tailwindcss";
.settings {
  @apply pt-8 mt-8;
  border-top: 1px solid var(--color-border);

  @media (max-width: 640px) {
    @apply pt-6 mt-6;
  }
}

.settings-title {
  @apply text-lg font-semibold mb-6;
  color: var(--color-heading);

  @media (max-width: 640px) {
    @apply text-base mb-4;
  }
}
</style>
