<template>
  <div class="section-card suspicious">
    <h3 class="section-heading">Suspicious Account Activity?</h3>
    <p class="warning-text mb-2">
      Recommended if your password was leaked, device was stolen, or suspicious activity detected.
    </p>
    <p class="muted-text mb-4">
      This generates a new RSA key pair and re-wraps your master key. Your data remains accessible.
    </p>
    <BaseButton variant="danger" @click="open = true">Perform Security Key Rotation</BaseButton>

    <BaseDialog
      v-if="open"
      title="Rotate RSA Keys"
      description="Enter your current password to proceed with key rotation."
      @close="closeDialog"
    >
      <form @submit.prevent="handleRotateRsa">
        <BaseInput
          v-model="rsaPassword"
          label="Password"
          type="password"
          :required="true"
          input-ref="rsa-password-input"
        />
        <p v-if="error" class="error-text mt-2">{{ error }}</p>
      </form>
      <template #actions>
        <BaseButton variant="secondary" type="button" @click="closeDialog">Cancel</BaseButton>
        <BaseButton variant="primary" :loading="loading" @click="handleRotateRsa">Rotate Keys</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { cryptoService } from '../../utils/crypto/cryptoService'
import { useNotification } from '../../composables/useNotification'
import BaseDialog from '../ui/BaseDialog.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'

const { showNotification } = useNotification()

const open = ref(false)
const loading = ref(false)
const error = ref('')
const rsaPassword = ref('')

watch(open, async (val) => {
  if (val) {
    await nextTick()
    document.getElementById('password')?.focus()
  }
})

function closeDialog() {
  open.value = false
  loading.value = false
  error.value = ''
  rsaPassword.value = ''
}

async function handleRotateRsa() {
  loading.value = true
  error.value = ''
  try {
    await cryptoService.rotateRsaKeys(rsaPassword.value)
    closeDialog()
    showNotification('RSA keys rotated successfully!', 'success')
  } catch (err) {
    error.value = err instanceof Error && err.message ? err.message : 'Failed to rotate RSA keys'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@reference "tailwindcss";
.section-heading {
  @apply font-semibold mb-2;
  font-size: 0.95rem;
  color: var(--color-danger-dark);

  [data-theme='dark'] & {
    color: var(--color-danger-light);
  }
}

.suspicious {
  border-color: var(--color-danger-light);
  background: linear-gradient(
    135deg,
    var(--color-danger-gradient-light-start) 0%,
    var(--color-danger-gradient-light-end) 100%
  );

  &:hover {
    border-color: var(--color-danger-hover);
  }

  [data-theme='dark'] & {
    border-color: var(--color-danger-dark);
    background: linear-gradient(
      135deg,
      var(--color-danger-gradient-dark-start) 0%,
      var(--color-danger-gradient-dark-end) 100%
    );
  }
}

.warning-text {
  @apply font-medium text-sm leading-[1.6];
  color: var(--color-danger-mid);

  [data-theme='dark'] & {
    color: var(--color-danger-light);
  }
}
</style>
