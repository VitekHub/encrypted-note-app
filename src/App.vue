<template>
  <main>
    <NoteEditor />
  </main>
</template>

<script setup lang="ts">
import NoteEditor from './components/NoteEditor.vue'
</script>

<style scoped>
main {
  display: flex;
  justify-content: center;
  padding: 48px 24px;
  width: 100%;
  box-sizing: border-box;
}
</style>
