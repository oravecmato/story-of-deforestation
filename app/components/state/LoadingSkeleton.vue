<script setup lang="ts">
import Skeleton from 'primevue/skeleton'

// Per-region loading placeholder (UI §9). Isolated: only the panel that is fetching shows it, so a
// slow endpoint never blanks the whole page. Defaults to filling its container's full height (the viz
// cell) rather than an arbitrary fixed size; callers with a definite target still pass an explicit one.
withDefaults(defineProps<{ height?: string }>(), { height: '100%' })
</script>

<template>
  <Skeleton width="100%" :height="height" border-radius="10px" />
</template>
