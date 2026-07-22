<script setup lang="ts">
import { computed, watch } from 'vue'
import { getSlide, nextSlug, prevSlug, FIRST_SLUG, slideIndex, SLUGS } from '../../story/slides'
import { renderSlide, type RenderableSlide, type ChartComponentName } from '../../story/SlideFactory'
import GenericSlide from '../../components/deck/GenericSlide.vue'
import DeckNav from '../../components/deck/DeckNav.vue'
import LanguageSwitcher from '../../components/controls/LanguageSwitcher.vue'
import { useApi } from '../../composables/useApi'
import { useBreakpoint } from '../../composables/useBreakpoint'
import { useSwipeNav } from '../../composables/useSwipeNav'
import { useDataStore, type EndpointKey } from '../../stores/data'
import { useViewStore } from '../../stores/view'
import { useUiStore, type Locale } from '../../stores/ui'

// StoryPage (tech-spec §17.2/§17.3, ADR-023): the ONE persistent route for the whole deck. Only
// `route.params.slug` changes as the reader advances, so Vue Router reuses this component (no remount)
// — the stage swaps and, within a scene, charts animate in place. This page owns scene entry (policy
// A), the server-authoritative load for the active slide, next-slide prefetch, and the slug ↔ scene
// params URL sync. Copy is i18n keys only; every value is a Pinia getter.
// A constant page key across every slug so Nuxt reuses ONE `[slug].vue` instance for the whole deck
// (ADR-023). Without it NuxtPage keys by `route.path`, which changes per slug, remounting the entire
// stage — and every chart from scratch — on each navigation, defeating the in-place animations. Scene
// boundaries are handled a level down by `viz.id` keying, not by remounting the page.
definePageMeta({ key: 'story-deck' })

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const api = useApi()
const data = useDataStore()
const view = useViewStore()
const ui = useUiStore()

ui.setLocale(locale.value as Locale)
useBreakpoint()

const slug = computed(() => String(route.params.slug ?? ''))

// Unknown slug → send the reader to the deck entry (the render below falls back to the first slide so
// setup stays type-safe until the redirect resolves).
if (!getSlide(slug.value)) {
  await navigateTo(`/story/${FIRST_SLUG}`, { replace: true })
}

const def = computed(() => getSlide(slug.value) ?? getSlide(FIRST_SLUG)!)
const slide = computed<RenderableSlide>(() => renderSlide(def.value, view.derivationParams))
const slideNumber = computed(() => slideIndex(slug.value) + 1)

/** The DTO endpoints a resolved visualisation needs (deck subset). */
const vizEndpoints = (component: ChartComponentName): EndpointKey[] => {
  switch (component) {
    case 'GlobalStackedAreaChart':
      return ['global']
    case 'CrossingChart':
      return ['global']
    case 'FootprintDonut':
      return ['reference', 'global']
    case 'FossilComparisonChart':
      return ['reference', 'global']
    case 'FluxBarChart':
      // Editorial illustration with hardcoded values — needs no server data.
      return []
  }
}

/** The union of endpoints an entire slide needs, walked off its widgets (ADR-027). A viz widget
 *  contributes its chart's DTO endpoints; an equivalence widget additionally needs `equivalence` — its
 *  country-unit basis is the reference country's annual CO₂, back-computed from that DTO (§17.4). */
const endpointsFor = (s: RenderableSlide): EndpointKey[] => {
  const set = new Set<EndpointKey>()
  for (const w of s.widgets) {
    if (w.type === 'viz') for (const e of vizEndpoints(w.component)) set.add(e)
    else if (w.type === 'equivalence') set.add('equivalence')
  }
  return [...set]
}

/** Enter the active slide's scene (seed on first visit, restore on return — policy A). On the very
 *  first render we hydrate the scene from the URL query so deep links land on the right params. */
const applyScene = (initial: boolean) => {
  const seed = { params: def.value.params, forced: def.value.forced, baseline: def.value.baseline }
  if (initial) view.initSceneFromQuery(def.value.scene, route.query, seed)
  else view.enterScene(def.value.scene, seed)
}

/** Fetch the active slide's endpoints (nothing for the text-only intro). */
const runLoad = async (): Promise<boolean> => {
  const eps = endpointsFor(slide.value)
  if (eps.length) await data.loadForScene(api, { params: slide.value.params, endpoints: eps })
  return true
}

/** Warm the next slide's endpoints on idle so forward navigation is instant (ADR-023). */
const prefetchNext = () => {
  if (!import.meta.client) return
  const n = nextSlug(slug.value)
  const nd = n ? getSlide(n) : undefined
  if (!nd) return
  const ns = renderSlide(nd, view.derivationParams)
  const eps = endpointsFor(ns)
  if (!eps.length) return
  const warm = () => data.prefetch(api, ns.params, eps)
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm)
  else setTimeout(warm, 200)
}

// Enter the initial scene BEFORE the first load so the params are in place for SSR.
applyScene(true)

// Swipe navigation on mobile/tablet (design §5.1): the active slide follows the finger and a >50%
// drag commits to the adjacent slug. Desktop keeps the edge-arrow lanes (`enabled` gates by breakpoint).
const swipe = useSwipeNav({
  enabled: () => ui.breakpoint !== 'lg',
  canPrev: () => prevSlug(slug.value) != null,
  canNext: () => nextSlug(slug.value) != null,
  onCommit: (dir) => {
    const target = dir === 'next' ? nextSlug(slug.value) : prevSlug(slug.value)
    if (target) onNavigate(target)
  },
})

// Scene entry on slug change — registered before the load watcher so params update first. Also snaps
// the swipe panel back to centre now the new slide's content is mounted (no flash of the outgoing one).
watch(slug, () => {
  applyScene(false)
  prefetchNext()
  swipe.reset()
})

const loadKey = computed(() => `${slug.value}|${JSON.stringify(view.query)}|${ui.locale}`)
await useAsyncData('story-slide', runLoad, { watch: [loadKey] })

if (import.meta.client) prefetchNext()

// Keep the current scene's derivation params in the URL (replace, no history spam). The slug is the
// path; metric selection stays out (ADR-017/021).
watch(
  () => view.query,
  (query) => {
    router.replace({ query })
  },
  { deep: true },
)

const onNavigate = (target: string) => {
  navigateTo(`/story/${target}`)
}
</script>

<template>
  <div class="deck">
    <div class="deck__inner">
      <header class="deck__header">
        <div class="deck__brand">
          <span class="deck__title">{{ t('deck.title') }}</span>
          <span class="deck__count">{{ t('deck.progress', { n: slideNumber, total: SLUGS.length }) }}</span>
        </div>
        <div class="deck__actions">
          <LanguageSwitcher />
        </div>
      </header>

      <!-- Not keyed by slug: the persistent GenericSlide instance lets sibling slides in a scene
           animate in place (charts remount only when their viz.id changes across a scene boundary).
           On mobile/tablet the stage owns the swipe gesture; the panel translates with the finger and
           the dark stage revealed behind it is the empty next/prev screen (desktop: transform is a
           no-op via `display: contents`, the edge-arrow lanes navigate instead). -->
      <main
        class="deck__stage"
        @pointerdown="swipe.onPointerDown"
        @pointermove="swipe.onPointerMove"
        @pointerup="swipe.onPointerUp"
        @pointercancel="swipe.onPointerUp"
      >
        <div
          class="deck__panel"
          :class="{ 'deck__panel--dragging': swipe.dragging.value }"
          :style="swipe.panelStyle.value"
          @transitionend="swipe.onTransitionEnd"
        >
          <GenericSlide :slide="slide" />
        </div>
      </main>

      <DeckNav :slug="slug" @navigate="onNavigate" />
    </div>
  </div>
</template>

<style scoped lang="scss">
// The gutter reserved on each side for the fixed edge-arrow nav lanes (DeckNav). Capping the content
// container's max-width by twice this guarantees the arrows always have room and never overlap a slide.
.deck {
  --arrow-lane: clamp(44px, 6vw, 120px);
}
.deck__inner {
  max-width: min(1360px, calc(100vw - 2 * var(--arrow-lane)));
  margin: 0 auto;
  padding: 0 24px 24px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
// Desktop: bind the whole deck to the viewport so header and nav stay pinned and every slide fits in
// exactly one screen. The stage does NOT scroll — the slide grid sizes its viz rows to the leftover
// height and the charts shrink to fit (see SlideLayout + Widget). `overflow: hidden` is only a guard
// against sub-pixel spill. On mobile the deck keeps its natural `min-height` flow and the page scrolls.
@include desktop {
  .deck__inner {
    height: 100vh;
  }
  .deck__stage {
    min-height: 0;
    overflow: hidden;
  }
}
.deck__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 0;
  border-bottom: 1px solid var(--c-border-hairline);
}
.deck__brand {
  display: flex;
  align-items: baseline;
  gap: 16px;
  min-width: 0;
}
.deck__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--c-text-hi);
}
.deck__count {
  font-size: 13px;
  color: var(--c-text-low);
}
.deck__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.deck__stage {
  flex: 1 1 auto;
  padding: 24px 0;
}
// The swipe panel: on mobile/tablet it is the box that translates under the finger. On desktop it is
// laid out as if it were not there (`display: contents`), so GenericSlide stays a direct child of the
// stage and the fixed-height desktop layout is unchanged; the transform (always translateX(0) there,
// the gesture is disabled) has no box to act on.
.deck__panel {
  will-change: transform;
}
.deck__panel--dragging {
  user-select: none;
}
@include desktop {
  .deck__panel {
    display: contents;
  }
}
// Mobile/tablet: no edge-arrow lanes (DeckNav is hidden, swipe-only nav), so the content is no longer
// capped by the arrow gutters — it spans the full viewport width with a fixed 20px side padding.
// Also clip the panel horizontally when it is dragged/settled off-stage (`clip` does NOT create a
// scroll container, so the page still scrolls vertically), and `pan-y` lets the browser keep vertical
// scroll while the swipe owns the horizontal axis.
@include mobile {
  .deck__inner {
    max-width: none;
    padding: 0 20px 24px;
  }
  .deck__stage {
    overflow-x: clip;
    touch-action: pan-y;
  }
}
</style>
