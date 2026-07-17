<script setup lang="ts">
import Select from 'primevue/select'
import { computed } from 'vue'
import type { DomainId } from '../../../shared/types'
import { SCOPE_SELECTOR_OPTIONS } from '../../../shared/config/scopeSelector'
import { useViewStore } from '../../stores/view'

// The main-scene domain control (business §4.1, design §5.1). The deck is global-first: the reader
// narrows the global aggregate down to a single rainforest domain (or back to Global). It maps the
// single selection onto the view store's `selectDomain`, which flips scope + domain and resets the
// scene's time range. Crossing / footprint are forced global, so this control lives only on the main
// scene.
const { t } = useI18n()
const view = useViewStore()

const options = computed(() =>
  SCOPE_SELECTOR_OPTIONS.map((o) => ({
    key: o.domainId ?? 'global',
    label: t(o.labelKey),
    divider: o.divider,
  })),
)

const model = computed<string>({
  get: () => (view.scope === 'global' ? 'global' : view.domainId),
  set: (key) => {
    if (!key) return
    view.selectDomain(key === 'global' ? 'global' : (key as DomainId))
  },
})
</script>

<template>
  <Select
    v-model="model"
    :options="options"
    option-label="label"
    option-value="key"
    :aria-label="t('scope.label')"
    class="domain-select"
  >
    <template #option="{ option }">
      <span :class="['domain-option', { 'domain-option--divided': option.divider }]">{{
        option.label
      }}</span>
    </template>
  </Select>
</template>

<style scoped>
.domain-select {
  min-width: 13rem;
}
.domain-option--divided {
  display: block;
  padding-top: 8px;
  margin-top: 4px;
  border-top: 1px solid var(--c-border-hairline);
}
</style>
