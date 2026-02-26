<template>
  <div class="app-info">
    <div class="about">
      <h2 class="section-title">About</h2>
      <p class="about-text">
        A private, zero-knowledge notepad. Your note is encrypted in the browser using AES-256-GCM.
        Passwords are checked against the HaveIBeenPwned database.
        This is an alfa version with "Drop Database" button that removes everything from the local storage.
      </p>
    </div>

    <div class="coming-soon">
      <h2 class="section-title">Coming Soon</h2>
      <ul class="feature-list">
        <li v-for="feature in features" :key="feature.title" class="feature-item">
          <span class="feature-dot" />
          <div>
            <span class="feature-title">{{ feature.title }}</span>
            <span class="feature-desc"> - {{ feature.desc }}</span>
          </div>
        </li>
      </ul>
    </div>

    <div class="encryption-roadmap-section">
      <EncryptionRoadmap />
    </div>
  </div>
</template>

<script setup lang="ts">
import EncryptionRoadmap from './EncryptionRoadmap.vue'

const features = [
  {
    title: 'Supabase-powered backend',
    desc: 'Cloud persistence replacing browser-only localStorage.',
  },
  {
    title: 'Account & email authentication',
    desc: 'Sign in with your email.',
  },
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

<style lang="scss" scoped>
$color-about: #2e86c1;
$color-coming-soon: #1e8449;

%section-title-base {
  margin: 0 0 10px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.app-info {
  margin-top: 32px;
  padding-top: 28px;
  border-top: 1.5px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.about {
  .section-title {
    @extend %section-title-base;
    color: $color-about;
  }
}

.coming-soon {
  .section-title {
    @extend %section-title-base;
    color: $color-coming-soon;
  }
}

.encryption-roadmap-section {
  :deep(.section-title) {
    @extend %section-title-base;
  }
}

.about-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--color-text);
  opacity: 0.8;
}

.feature-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--color-text);
  opacity: 0.75;
}

.feature-dot {
  flex-shrink: 0;
  margin-top: 7px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: $color-coming-soon;
  opacity: 0.8;
}

.feature-title {
  font-weight: 500;
}

.feature-desc {
  color: var(--color-muted);
}
</style>
