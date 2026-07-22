// Nuxt 3, SSR universal, Nitro BFF (ADR-001 / tech-spec §14).
import { AppPreset } from './app/theme/primePreset'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  // SSR universal (ADR-001).
  ssr: true,

  // Nuxt 4 directory layout (app/, server/, shared/) — matches tech-spec §1.
  future: { compatibilityVersion: 4 },

  modules: [
    '@nuxt/eslint',
    '@pinia/nuxt',
    'nuxt-echarts',
    '@nuxtjs/i18n',
    '@primevue/nuxt-module',
  ],

  // Global dark base styles (design §2–4).
  css: ['~/assets/css/main.css'],

  // Inject the shared SCSS breakpoint mixins ($bp-desktop, `@include desktop/mobile`) into every
  // component `<style lang="scss">` block so the deck's responsive boundary lives in one place.
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/scss/breakpoints" as *;\n',
        },
      },
    },
  },

  // Fixed dark V1 (ADR-002): a stable `.app-dark` class on <html> is the PrimeVue dark selector.
  // Inter (UI/copy) + IBM Plex Mono (numbers/badge) per design §3, with system fallbacks in CSS.
  app: {
    head: {
      htmlAttrs: { class: 'app-dark' },
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=Inter:wght@400;500;600&display=swap',
        },
      ],
    },
  },

  // PrimeVue v4 (tech-spec §13/§14): Aura restyled by the shared ThemeTokens (see app/theme).
  // No unstyled mode; ripple off for the quiet, instrument-like feel (design §1).
  primevue: {
    options: {
      ripple: false,
      theme: {
        preset: AppPreset,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: { name: 'primevue', order: 'theme, base, primevue' },
        },
      },
    },
  },

  // ECharts registration centralized here for tree-shaking (ADR-006, tech-spec §14). Only the
  // chart types + components the option classes use are bundled.
  echarts: {
    renderer: 'canvas',
    charts: ['LineChart', 'BarChart', 'PieChart', 'CustomChart'],
    components: [
      'GridComponent',
      'TooltipComponent',
      'LegendComponent',
      'MarkLineComponent',
      'MarkPointComponent',
      'MarkAreaComponent',
      'VisualMapComponent',
    ],
  },

  // i18n (ADR-011, tech-spec §12): SK/EN, no URL prefix, browser detection with a persistence
  // cookie, fallback en. Copy lives in i18n/locales/*.json (all display strings are keys). Pulled
  // forward from Layer 8 because the chart-option factory needs `t`; the copy set grows as screens land.
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', language: 'en-GB', file: 'en.json' },
      { code: 'sk', language: 'sk-SK', file: 'sk.json' },
    ],
    detectBrowserLanguage: { useCookie: true, cookieKey: 'i18n_locale', fallbackLocale: 'en' },
  },

  // Deploy target: Vercel serverless (ADR-014).
  nitro: {
    preset: 'vercel',
  },

  // Caching = CDN-first (ADR-005/014, tech-spec §8). Every /api/** response is a deterministic
  // function of its query string (the full DerivationParams signature), so the CDN caches by URL.
  // WB data changes ~yearly → a 6h fresh window with stale-while-revalidate.
  //
  // IMPORTANT: do NOT use the `swr` route-rule shortcut here. On the Vercel preset `swr` compiles to
  // Vercel ISR, whose cache key is the PATH ONLY (no `allowQuery`) → the query string is stripped, so
  // every horizon/baseline collapses onto one cached `/api/global` entry and the controls appear dead
  // in production. Setting an explicit `cache-control` header instead keeps the response a normal
  // function; Vercel's standard edge cache then keys by the FULL URL (query included) and honours
  // s-maxage + stale-while-revalidate — 6h fresh window, per-query cache. A second in-function
  // (defineCachedFunction) layer for warm instances is deferred to a follow-up.
  routeRules: {
    '/api/**': {
      headers: {
        'cache-control': 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400',
      },
    },
  },

  // Strict TypeScript across app and server (ADR-015).
  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true,
      },
    },
  },

  devtools: { enabled: true },
})
