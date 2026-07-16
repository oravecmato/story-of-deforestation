<script setup lang="ts">
import ScopeDomainSelect from '../controls/ScopeDomainSelect.vue'
import HorizonSelect from '../controls/HorizonSelect.vue'
import RScenarioToggle from '../controls/RScenarioToggle.vue'
import BaselineControl from '../controls/BaselineControl.vue'

// Sticky control bar (UI §3, design §5.1): scope anchors left, the time-horizon selector sits centered
// and largest (the signature control, ADR-019), R-scenario + baseline sit right. Every control is a
// pure intent emitter into the view store — no local data (UI §1.6).
</script>

<template>
  <div class="control-panel">
    <div class="control-panel__left">
      <ScopeDomainSelect />
    </div>
    <div class="control-panel__center">
      <HorizonSelect />
    </div>
    <div class="control-panel__right">
      <RScenarioToggle />
      <BaselineControl />
    </div>
  </div>
</template>

<style scoped>
.control-panel {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 0;
  background: var(--c-bg);
  border-bottom: 1px solid var(--c-border-hairline);
}
.control-panel__center {
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
}
.control-panel__right {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
