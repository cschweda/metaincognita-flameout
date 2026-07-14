import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  // Lets the suite mount .vue files (the logic tests never needed it).
  plugins: [vue()],

  test: {
    environment: 'happy-dom'
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app'),
      '#imports': resolve(__dirname, '.nuxt/imports.d.ts')
    }
  }
})
