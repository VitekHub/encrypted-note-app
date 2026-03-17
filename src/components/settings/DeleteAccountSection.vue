<template>
  <div class="section-card">
    <h3 class="section-heading">Delete Account</h3>
    <p class="muted-text mb-4">
      Permanently deletes your account, encrypted keys, note, and all associated data from the server. This cannot be
      undone.
    </p>
    <p v-if="deleteError" class="text-red-500 text-sm mb-3">{{ deleteError }}</p>
    <BaseButton variant="danger" :disabled="isDeleting" @click="showConfirm = true">Delete Account</BaseButton>

    <ConfirmDialog
      v-if="showConfirm"
      title="Delete Account"
      message="This will permanently delete your account and all associated data from the server, including your encrypted keys and note. There is no recovery option. Are you sure?"
      confirm-label="Delete Account"
      @confirm="handleDelete"
      @cancel="showConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore'
import BaseButton from '../ui/BaseButton.vue'
import ConfirmDialog from '../ui/ConfirmDialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const showConfirm = ref(false)
const isDeleting = ref(false)
const deleteError = ref<string | null>(null)

async function handleDelete() {
  isDeleting.value = true
  deleteError.value = null
  showConfirm.value = false
  try {
    await authStore.teardown()
    router.push('/login')
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete account. Please try again.'
  } finally {
    isDeleting.value = false
  }
}
</script>
