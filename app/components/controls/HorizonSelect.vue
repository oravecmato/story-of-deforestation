<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '../../stores/ui'
import HorizonSelectDesktop from './HorizonSelectDesktop.vue'
import HorizonSelectMobile from './HorizonSelectMobile.vue'

// Horizon control shell (design §5.1): the signature interaction (ADR-019) takes two forms. On phones
// the wide button group does not fit, so it collapses to a compact labelled dropdown; tablet + desktop
// keep the button group. Both twins bind the SAME view-store horizon, so they are rendered together and
// toggled with `v-show` (never remounted) — the inactive one is just hidden, the active one stays live.
const ui = useUiStore()
const isMobile = computed(() => ui.breakpoint === 'sm')
</script>

<template>
  <HorizonSelectMobile v-show="isMobile" />
  <HorizonSelectDesktop v-show="!isMobile" />
</template>
