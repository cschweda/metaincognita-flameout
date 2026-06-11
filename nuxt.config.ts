// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt'
  ],

  ssr: false,

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },

  spaLoadingTemplate: true,

  routeRules: {
    '/': { prerender: true },
    '/learn': { prerender: true }
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
