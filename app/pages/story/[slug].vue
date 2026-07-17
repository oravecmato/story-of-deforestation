<script setup lang="ts">
import { computed, watch } from 'vue'
import { getSlide, nextSlug, FIRST_SLUG, slideIndex, SLUGS } from '../../story/slides'
import { renderSlide, type RenderableSlide, type ChartComponentName } from '../../story/SlideFactory'
import type { Scope } from '../../../shared/types'
import GenericSlide from '../../components/deck/GenericSlide.vue'
import DeckNav from '../../components/deck/DeckNav.vue'
import LanguageSwitcher from '../../components/controls/LanguageSwitcher.vue'
import MethodologyDisclosure from '../../components/shell/MethodologyDisclosure.vue'
import { useApi } from '../../composables/useApi'
import { useBreakpoint } from '../../composables/useBreakpoint'
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
const vizEndpoints = (component: ChartComponentName, scope: Scope): EndpointKey[] => {
  switch (component) {
    case 'MainStackedChart':
      return ['domain']
    case 'GlobalStackedAreaChart':
      return ['global']
    case 'CrossingChart':
      return scope === 'global' ? ['global'] : ['domain']
    case 'FootprintDonut':
      return ['reference', 'global']
    case 'FossilComparisonChart':
      return ['reference', 'global']
  }
}

/** The union of endpoints an entire slide needs. The slide-6 equivalence strip (`duo-viz-equiv`,
 *  ADR-025) additionally needs `equivalence` — its country-unit basis is the reference country's
 *  annual CO₂, back-computed from that DTO (§17.4). */
const endpointsFor = (s: RenderableSlide): EndpointKey[] => {
  const set = new Set<EndpointKey>()
  for (const v of s.visuals) for (const e of vizEndpoints(v.component, s.params.scope)) set.add(e)
  if (s.layout === 'duo-viz-equiv') set.add('equivalence')
  return [...set]
}

/** Enter the active slide's scene (seed on first visit, restore on return — policy A). On the very
 *  first render we hydrate the scene from the URL query so deep links land on the right params. */
const applyScene = (initial: boolean) => {
  const seed = { params: def.value.params, forced: def.value.forced }
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

// Scene entry on slug change — registered before the load watcher so params update first.
watch(slug, () => {
  applyScene(false)
  prefetchNext()
})

const loadKey = computed(() => `${slug.value}|${JSON.stringify(view.query)}|${ui.locale}`)
await useAsyncData('story-slide', runLoad, { watch: [loadKey] })

if (import.meta.client) prefetchNext()

// Keep the current scene's derivation params in the URL (replace, no history spam). The slug is the
// path; timeRange and metric selection stay out (ADR-017/021).
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
          <MethodologyDisclosure />
        </div>
      </header>

      <!-- Not keyed by slug: the persistent GenericSlide instance lets sibling slides in a scene
           animate in place (charts remount only when their viz.id changes across a scene boundary). -->
      <main class="deck__stage">
        <GenericSlide :slide="slide" />
      </main>

      <DeckNav :slug="slug" @navigate="onNavigate" />
    </div>
  </div>
</template>

<style scoped>
.deck__inner {
  max-width: 1360px;
  margin: 0 auto;
  padding: 0 24px 24px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
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
</style>
