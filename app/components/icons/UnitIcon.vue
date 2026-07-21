<script setup lang="ts">
import { useId } from 'vue'

// Tiny inline-SVG icon for the equivalence-strip units (§17.4). We deliberately DON'T pull an icon
// font/library (none is loaded in this app — the project convention is inline SVG): only the icons
// actually referenced here are bundled, and there is nothing to tree-shake away. `car` is a
// currentColor glyph (inherits the cell colour); `sk`/`gb` are full-colour national flags. The Union
// Jack needs a counter-change clip-path whose id must be unique + SSR-stable, hence `useId()`.
defineProps<{ name: 'car' | 'sk' | 'gb' }>()
const uid = useId()
</script>

<template>
  <svg v-if="name === 'car'" class="unit-icon unit-icon--glyph" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"
    />
  </svg>

  <svg v-else-if="name === 'sk'" class="unit-icon unit-icon--flag" viewBox="0 0 24 16" aria-hidden="true">
    <rect width="24" height="16" fill="#ffffff" />
    <rect y="5.333" width="24" height="5.334" fill="#0b4ea2" />
    <rect y="10.667" width="24" height="5.333" fill="#ee1c25" />
    <path d="M3 3 H8 V7 C8 9.5 6.8 11 5.5 11.8 C4.2 11 3 9.5 3 7 Z" fill="#ee1c25" stroke="#ffffff" stroke-width="0.6" />
    <path d="M3.7 9.2 C4.3 8.4 4.9 8.4 5.5 9.2 C6.1 8.4 6.7 8.4 7.3 9.2 V10 C6.7 10.9 6.1 11.1 5.5 11.5 C4.9 11.1 4.3 10.9 3.7 10 Z" fill="#0b4ea2" />
    <path d="M5.5 4.2 V10 M4.4 5.7 H6.6 M3.9 7.1 H7.1" stroke="#ffffff" stroke-width="0.7" stroke-linecap="round" fill="none" />
  </svg>

  <svg v-else class="unit-icon unit-icon--flag" viewBox="0 0 60 30" aria-hidden="true">
    <clipPath :id="`${uid}-t`"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
    <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" stroke-width="6" />
    <path d="M0,0 L60,30 M60,0 L0,30" :clip-path="`url(#${uid}-t)`" stroke="#c8102e" stroke-width="4" />
    <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" stroke-width="10" />
    <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" stroke-width="6" />
  </svg>
</template>

<style scoped>
.unit-icon {
  display: inline-block;
  width: auto;
  /* Sit the icon's bottom on the number's text baseline so a tall glyph grows UPWARD and never dips
     below the line (the car glyph, being >1em, overhung the descender with `middle`). Uniform across
     glyph + flags. */
  vertical-align: baseline;
}
/* The car glyph is hardcoded larger so it reads clearly bigger than the "×" operator it follows. The
   flags are already larger and colour-differentiated, so they keep the base size. Being taller than
   the line, the glyph is dropped to `text-bottom` so its LOWER edge rests on the text's bottom and it
   grows upward from there (baseline left its bottom sitting a touch high). */
.unit-icon--glyph {
  height: 1.7em;
  vertical-align: text-bottom;
}
.unit-icon--flag {
  height: 1.05em;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18);
}
</style>
