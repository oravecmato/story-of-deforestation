<script setup lang="ts">
import { computed } from 'vue'

// Server-rendered, localised SEO + social-share metadata for the whole deck — one shared title and
// description across every slug. useSeoMeta runs during SSR, so the tags ship already localised in the
// initial HTML (crawlers/scrapers see them without executing JS); t() reacts to the active locale, so a
// language switch also re-titles the document and the share card.
const { t, locale } = useI18n()
const url = useRequestURL()

// Absolute URLs are mandatory for og:image / og:url on every major crawler. The request origin is
// resolved server-side (and from the browser location on the client), so this is host-agnostic — it is
// correct on localhost, preview deploys and production alike without a hardcoded base URL.
const origin = computed(() => `${url.protocol}//${url.host}`)
const ogImage = computed(() => `${origin.value}/og-cover.png`)
const canonical = computed(() => `${origin.value}${url.pathname}`)

// og:locale wants the underscore form (en_GB / sk_SK). Both locales serve on the SAME URL (no_prefix),
// so the alternate is just the other language, advertised for scrapers that honour it.
const OG_LOCALE: Record<string, string> = { en: 'en_GB', sk: 'sk_SK' }
const ogLocale = computed(() => OG_LOCALE[locale.value] ?? 'en_GB')
const ogLocaleAlt = computed(() => (locale.value === 'sk' ? 'en_GB' : 'sk_SK'))

useSeoMeta({
  title: () => t('deck.title'),
  description: () => t('seo.description'),
  applicationName: () => t('deck.title'),
  themeColor: '#0D1117',
  // Open Graph (Facebook, LinkedIn, Slack, iMessage, …).
  ogType: 'website',
  ogSiteName: () => t('deck.title'),
  ogTitle: () => t('deck.title'),
  ogDescription: () => t('seo.description'),
  ogUrl: () => canonical.value,
  ogLocale: () => ogLocale.value,
  ogLocaleAlternate: () => ogLocaleAlt.value,
  ogImage: () => ogImage.value,
  ogImageSecureUrl: () => ogImage.value,
  ogImageType: 'image/png',
  ogImageWidth: 2004,
  ogImageHeight: 732,
  ogImageAlt: () => t('seo.imageAlt'),
  // Twitter / X large-image card.
  twitterCard: 'summary_large_image',
  twitterTitle: () => t('deck.title'),
  twitterDescription: () => t('seo.description'),
  twitterImage: () => ogImage.value,
  twitterImageAlt: () => t('seo.imageAlt'),
})

useHead({
  htmlAttrs: { lang: () => locale.value },
  meta: [{ name: 'robots', content: 'index, follow' }],
  link: [{ rel: 'canonical', href: () => canonical.value }],
})
</script>

<template>
  <NuxtPage />
</template>
