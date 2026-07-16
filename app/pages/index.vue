<script setup lang="ts">
import { computed } from 'vue'
import AppHeader from '../components/shell/AppHeader.vue'
import ControlPanel from '../components/shell/ControlPanel.vue'
import MainCanvas from '../components/shell/MainCanvas.vue'
import MagnitudePanels from '../components/shell/MagnitudePanels.vue'
import EquivalencePanel from '../components/shell/EquivalencePanel.vue'
import { useApi } from '../composables/useApi'
import { useRouteSync } from '../composables/useRouteSync'
import { useBreakpoint } from '../composables/useBreakpoint'
import { useDataStore } from '../stores/data'
import { useViewStore } from '../stores/view'
import { useUiStore, type Locale } from '../stores/ui'

// The single-page composer (UI §1). Wires URL ↔ view state, seeds the ui locale from i18n, tracks
// the breakpoint, and drives the server-authoritative data load. Every displayed value comes from
// Pinia getters via the shell components (ADR-003); this page holds no data of its own.
const { t, locale } = useI18n()
const api = useApi()
const data = useDataStore()
const view = useViewStore()
const ui = useUiStore()

// Seed the ui-store locale (single source for the reactive equivalence reference country, §4.4).
ui.setLocale(locale.value as Locale)

useRouteSync()
useBreakpoint()

// SSR + client data load (ADR-004): re-runs whenever the derivation signature (horizon included) or
// locale changes. The store cache (a Map) hydrates via Nuxt's devalue payload, so a warm SSR fetch
// renders instantly on the client.
const loadKey = computed(() => `${JSON.stringify(view.query)}|${ui.locale}`)
await useAsyncData('deforestation-view', () => data.loadForCurrentView(api).then(() => true), {
  watch: [loadKey],
})
</script>

<template>
  <div class="app-shell">
    <div class="app-shell__inner">
      <AppHeader />
      <ControlPanel />
      <main class="app-shell__main">
        <MainCanvas />
        <MagnitudePanels />
        <EquivalencePanel />
      </main>
      <footer class="app-shell__footer">{{ t('app.footer') }}</footer>
    </div>
  </div>
</template>

<style scoped>
.app-shell__inner {
  max-width: 1360px;
  margin: 0 auto;
  padding: 0 24px 48px;
}
.app-shell__main {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 24px;
}
.app-shell__footer {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--c-border-hairline);
  color: var(--c-text-low);
  font-size: 12px;
}
</style>
