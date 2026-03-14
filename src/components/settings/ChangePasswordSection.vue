<template>
  <div class="section-card">
    <h3 class="section-heading">Password Management</h3>
    <p class="muted-text mb-4">
      Change your master password. This re-encrypts your RSA private key with the new password.
    </p>
    <BaseButton @click="open = true">Change Password</BaseButton>

    <BaseDialog v-if="open" title="Change Password" @close="closeDialog">
      <form class="flex flex-col gap-4" @submit.prevent="handleChangePassword">
        <BaseInput
          v-model="oldPassword"
          label="Current Password"
          type="password"
          :required="true"
          input-ref="current-password-input"
        />
        <BaseInput v-model="newPassword" label="New Password" type="password" :required="true" />
        <BaseInput v-model="confirmPassword" label="Confirm New Password" type="password" :required="true" />
        <p v-if="error" class="error-text">{{ error }}</p>
      </form>
      <template #actions>
        <BaseButton variant="secondary" type="button" @click="closeDialog">Cancel</BaseButton>
        <BaseButton
          variant="primary"
          type="submit"
          :disabled="newPassword !== confirmPassword"
          :loading="loading"
          @click="handleChangePassword"
        >
          Change
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { cryptoService } from '../../utils/crypto/cryptoService'
import { useNotificationStore } from '../../stores/notificationStore'
import BaseDialog from '../ui/BaseDialog.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'

const { showNotification } = useNotificationStore()

const open = ref(false)
const loading = ref(false)
const error = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

watch(open, async (val) => {
  if (val) {
    await nextTick()
    document.getElementById('current-password')?.focus()
  }
})

function closeDialog() {
  open.value = false
  loading.value = false
  error.value = ''
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
}

async function handleChangePassword() {
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'New passwords do not match'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await cryptoService.updatePassword(oldPassword.value, newPassword.value)
    closeDialog()
    showNotification('Password changed successfully!', 'success')
  } catch (err) {
    error.value = err instanceof Error && err.message ? err.message : 'Failed to change password'
  } finally {
    loading.value = false
  }
}
</script>
