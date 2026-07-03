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
  // runtime on static hosting — which the CSP (connect-src 'self') blocks.
  // The explicit list covers icons referenced outside the scan globs
  // (GAME_MODES in app/types/flameout.ts).
  icon: {
    clientBundle: {
      scan: true,
      icons: ['lucide:flame', 'lucide:swords', 'lucide:diamond']
    }
  }
})
