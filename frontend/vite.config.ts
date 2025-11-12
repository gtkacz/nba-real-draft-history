import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_URL || process.env.BASE_URL || '/',
  plugins: [
    vue(),
    vueJsx(),
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vuetify': ['vuetify'],
          'vue-vendor': ['vue', 'vue-router', 'pinia']
        }
      }
    }
  },
  server: {
    port: 3000,
    strictPort: false
  }
})
