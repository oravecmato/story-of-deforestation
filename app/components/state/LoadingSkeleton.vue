<script setup lang="ts">
import Skeleton from 'primevue/skeleton'

// Per-region loading placeholder (UI §9). Isolated: only the panel that is fetching shows it, so a
// slow endpoint never blanks the whole page.
withDefaults(defineProps<{ height?: string }>(), { height: '240px' })
</script>

<template>
  <Skeleton width="100%" :height="height" border-radius="10px" />
</template>
