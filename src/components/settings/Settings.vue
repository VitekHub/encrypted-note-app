<template>
  <div class="settings">
    <h2 class="settings-title">Security Settings</h2>
    <AutoLockSection />
    <ChangePasswordSection />
    <KeyRotationSection />
    <Argon2Section />
    <DeleteAccountSection />
  </div>
</template>

<script setup lang="ts">
import AutoLockSection from './AutoLockSection.vue'
import ChangePasswordSection from './ChangePasswordSection.vue'
import KeyRotationSection from './KeyRotationSection.vue'
import Argon2Section from './Argon2Section.vue'
import DeleteAccountSection from './DeleteAccountSection.vue'
</script>

<style scoped>
@reference "tailwindcss";
.settings {
  @apply pt-2;
}

.settings-title {
  @apply text-lg font-semibold mb-6;
  color: var(--color-heading);

  @media (max-width: 640px) {
    @apply text-base mb-4;
  }
}
</style>
