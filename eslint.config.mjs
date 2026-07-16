// @nuxt/eslint generates a flat config into .nuxt/eslint.config.mjs during `nuxt prepare`
// (ADR-015). This root config extends it so `eslint .` is Nuxt-aware.
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt()
