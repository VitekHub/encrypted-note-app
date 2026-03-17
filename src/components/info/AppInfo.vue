<template>
  <div class="app-info">
    <div>
      <h2 class="section-title section-title--about">About</h2>
      <p class="about-text">
        A private, end-to-end encrypted notepad with username-based authentication. Your note is protected by a hybrid
        RSA-4096 + AES-256-GCM encryption scheme where all keys are derived and managed entirely in your browser.
        Passwords are checked against the HaveIBeenPwned database. Encrypted data is stored in the cloud via Supabase,
        making your note accessible across devices while remaining unreadable to the server.
      </p>
    </div>

    <div>
      <h2 class="section-title section-title--coming-soon">Coming Soon</h2>
      <ul class="list-none m-0 p-0 flex flex-col gap-2.5">
        <li v-for="feature in features" :key="feature.title" class="feature-item">
          <span class="feature-dot" />
          <div>
            <span class="font-medium">{{ feature.title }}</span>
            <span class="feature-desc">{{ ` - ${feature.desc}` }}</span>
          </div>
        </li>
      </ul>
    </div>

    <EncryptionRoadmap />
  </div>
</template>

<script setup lang="ts">
import EncryptionRoadmap from './EncryptionRoadmap.vue'

const features = [
  {
    title: 'Zero-knowledge authentication',
    desc: 'A true zero-knowledge protocol (SRP / OPAQUE) so that passwords never leave the browser.',
  },
  {
    title: 'Recovery phrase',
    desc: 'A personal mnemonic that lets you regain access to your note if you ever forget your password.',
  },
]
</script>

<style scoped>
@reference "tailwindcss";
.app-info {
  @apply flex flex-col gap-6;
}

.section-title {
  @apply mb-2.5 text-xs font-semibold tracking-[0.08em] uppercase;
}

.section-title--about {
  color: var(--color-info-about);
}

.section-title--coming-soon {
  color: var(--color-info-coming-soon);
}

.about-text {
  @apply m-0 text-sm leading-[1.65] opacity-80;
  color: var(--color-text);
}

.feature-item {
  @apply flex items-start gap-2.5 text-sm leading-[1.55] opacity-75;
  color: var(--color-text);
}

.feature-dot {
  @apply shrink-0 mt-[7px] w-[5px] h-[5px] rounded-full opacity-80;
  background-color: var(--color-info-coming-soon);
}

.feature-desc {
  color: var(--color-muted);
}
</style>
