<template>
  <div class="app-info">
    <div>
      <h2 class="section-title section-title--about">About</h2>
      <p class="about-text">
        A private, zero-knowledge notepad. Your note is encrypted in the browser using AES-256-GCM. Passwords are
        checked against the HaveIBeenPwned database. This is an alfa version with "Drop Database" button that removes
        everything from the local storage.
      </p>
    </div>

    <div>
      <h2 class="section-title section-title--coming-soon">Coming Soon</h2>
      <ul class="list-none m-0 p-0 flex flex-col gap-2.5">
        <li v-for="feature in features" :key="feature.title" class="feature-item">
          <span class="feature-dot" />
          <div>
            <span class="font-medium">{{ feature.title }}</span>
            <span class="feature-desc">- {{ feature.desc }}</span>
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
  { title: 'Supabase-powered backend', desc: 'Cloud persistence replacing browser-only localStorage.' },
  { title: 'Account & email authentication', desc: 'Sign in with your email.' },
  {
    title: 'Cloud key storage',
    desc: 'Your master key, encrypted and safely persisted in the database and accessible across devices.',
  },
  {
    title: 'Recovery phrase',
    desc: 'A personal mnemonic that lets you regain access to your note if you ever forget your password.',
  },
  {
    title: 'Cleaner interface',
    desc: 'Developer tools like "Drop Database" retire once proper account management ships.',
  },
]
</script>

<style scoped>
@reference "tailwindcss";
.app-info {
  @apply mt-8 pt-7 flex flex-col gap-6;
  border-top: 1.5px solid var(--color-border);
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
