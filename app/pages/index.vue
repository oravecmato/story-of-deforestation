<script setup lang="ts">
import { FIRST_SLUG } from '../story/slides'

// The app is a linear story deck on one persistent route (ADR-023). The index just redirects to the
// deck's entry slide; all rendering lives in `pages/story/[slug].vue`.
await navigateTo(`/story/${FIRST_SLUG}`, { replace: true })
</script>

<template>
  <div />
</template>
