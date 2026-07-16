<script setup lang="ts">
import LanguageSwitcher from '../controls/LanguageSwitcher.vue'
import MethodologyDisclosure from './MethodologyDisclosure.vue'

// Header (UI §2, design §6): title + one muted thesis line on the left; language toggle and the
// methodology link on the right. No nav, no logo chrome — quiet by intent (design §1).
const { t } = useI18n()
</script>

<template>
  <header class="app-header">
    <div class="app-header__brand">
      <h1 class="app-header__title">{{ t('app.title') }}</h1>
      <p class="app-header__thesis">{{ t('app.thesis') }}</p>
    </div>
    <div class="app-header__actions">
      <LanguageSwitcher />
      <MethodologyDisclosure />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 0;
}
.app-header__title {
  font-size: 24px;
  line-height: 32px;
}
.app-header__thesis {
  margin: 4px 0 0;
  color: var(--c-text-mid);
  max-width: 46ch;
}
.app-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
</style>
