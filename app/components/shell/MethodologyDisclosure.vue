<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { ref } from 'vue'

// Methodology disclosure (UI §10.8, design §6): a quiet text link in the header that opens a dialog
// explaining estimate-vs-measured, the lower-bound stance and the R caveats. All copy is i18n.
const { t } = useI18n()
const open = ref(false)
</script>

<template>
  <Button
    text
    size="small"
    :label="t('methodology.link')"
    icon="pi"
    @click="open = true"
  />
  <Dialog
    v-model:visible="open"
    modal
    dismissable-mask
    :header="t('methodology.title')"
    :style="{ width: '40rem', maxWidth: '92vw' }"
  >
    <p class="methodology__body">{{ t('methodology.body') }}</p>
  </Dialog>
</template>

<style scoped>
.methodology__body {
  margin: 0;
  color: var(--c-text-mid);
  line-height: 22px;
}
</style>
