// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt'
  ],

  // Full static generation: every route is rendered to real HTML at build
  // time (titles, meta, and the learn-page content are crawlable without
  // JS). The game itself stays client-only via its route rule below —
  // canvas, rAF loop, and localStorage session never run on the server.
  ssr: true,

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },

  spaLoadingTemplate: true,

  // The bottom nav navigates programmatically (to save the session first),
  // so the prerender crawler can't discover every route from links — list
  // them explicitly.
  routeRules: {
    '/': { prerender: true },
    '/learn': { prerender: true },
    '/history': { prerender: true },
    '/analysis': { prerender: true },
    '/game': { ssr: false, prerender: true }
  },

  experimental: {
    payloadExtraction: true
  },

  compatibilityDate: '2025-01-15',

  nitro: {
    preset: 'netlify_static'
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // Bundle all icons used in source into the client build. Without this,
  // @nuxt/icon falls back to fetching icon data from api.iconify.design at
  // runtime on static hosting — which the CSP (connect-src 'self') blocks,
  // so the icon renders as nothing at all.
  //
  // `scan` reads only this app's own source: its globs are
  // **/*.{vue,jsx,tsx,md,mdc,mdx,yml,yaml} and node_modules is excluded.
  // Two kinds of icon are therefore invisible to it and must be listed here
  // by hand, or they fail in production and nowhere else.
  icon: {
    clientBundle: {
      scan: true,
      icons: [
        // 1. Named in .ts, which the scan globs don't cover — GAME_MODES.
        'lucide:flame',
        'lucide:swords',
        'lucide:diamond',

        // 2. Nuxt UI's own defaults (app.config `ui.icons`), rendered from
        // inside node_modules — never scanned, and they appear in none of
        // our templates, which is exactly what makes them easy to miss.
        // Every UModal's close button is `ui.icons.close`: How to Play,
        // Leave Game?, and Start New Game? all shipped with an invisible ×.
        'lucide:x', // ui.icons.close — UModal ×3, UToast
        'lucide:loader-circle' // ui.icons.loading — UButton/UInput `loading`
      ]
    }
  }
})
