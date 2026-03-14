<template>
  <main class="flex justify-center px-6 py-12 w-full box-border">
    <div class="flex flex-col w-full max-w-[640px]">
      <AppHeader />
      <router-view />
      <NotificationContainer />
    </div>
  </main>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue'
import NotificationContainer from '../notification/NotificationContainer.vue'
</script>
