<script setup lang="ts">
import Select from 'primevue/select'
import { computed } from 'vue'
import { SCOPE_SELECTOR_OPTIONS } from '../../../shared/config/scopeSelector'
import { useViewStore } from '../../stores/view'

// Scope + domain in one dropdown (UI §3, design §6). The two derivation axes (scope + domainId)
// stay independent state; this control is the sole mapping from one selection back onto both.
// SCOPE_SELECTOR_OPTIONS drives the items (no hardcoded strings); a hairline divider precedes the
// default Global entry. Selecting a new region resets the ECharts time range via the store actions.
const { t } = useI18n()
const view = useViewStore()

const options = computed(() =>
  SCOPE_SELECTOR_OPTIONS.map((o) => ({
    key: o.domainId ?? 'global',
    label: t(o.labelKey),
    divider: o.divider,
    scope: o.scope,
    domainId: o.domainId,
  })),
)

const selectedKey = computed<string>({
  get: () => (view.scope === 'global' ? 'global' : view.domainId),
  set: (key) => {
    const opt = options.value.find((o) => o.key === key)
    if (!opt) return
    view.setScope(opt.scope)
    if (opt.domainId) view.setDomain(opt.domainId)
  },
})
</script>

<template>
  <Select
    v-model="selectedKey"
    :options="options"
    option-label="label"
    option-value="key"
    :aria-label="t('scope.label')"
    class="scope-select"
  >
    <template #option="{ option }">
      <span :class="['scope-option', { 'scope-option--divided': option.divider }]">{{
        option.label
      }}</span>
    </template>
  </Select>
</template>

<style scoped>
.scope-select {
  min-width: 15rem;
}
.scope-option--divided {
  display: block;
  padding-top: 8px;
  margin-top: 4px;
  border-top: 1px solid var(--c-border-hairline);
}
</style>
