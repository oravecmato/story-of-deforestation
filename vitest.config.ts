import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Pure-logic unit tests (statistics core, config, chart-option classes, formatter) run mount-free
// in a plain Node environment (ADR-013). Light component tests (e.g. BaseChart) opt into happy-dom
// via a per-file `// @vitest-environment happy-dom` docblock; the vue plugin compiles their SFCs.
export default defineConfig({
  // vitest bundles vite 5 types while @vitejs/plugin-vue is typed against vite 6/7 — the Plugin
  // shapes differ at the type level only; the transform is runtime-compatible.
  // @ts-expect-error cross-version vite Plugin type mismatch (vitest 5 vs plugin-vue 6/7)
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    globals: true,
  },
})
