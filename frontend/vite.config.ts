import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Gera o service worker (modo offline) com a lista de arquivos do build */
function serviceWorker(): Plugin {
  return {
    name: 'gdo-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const arquivos = Object.keys(bundle).filter(f => !f.endsWith('.map'))
      const publicos = ['manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png']
      const precache = ['/', '/index.html', ...[...arquivos, ...publicos].filter(f => f !== 'index.html').map(f => `/${f}`)]
      const versao = createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 10)
      const fonte = readFileSync(new URL('./sw.js', import.meta.url), 'utf-8')
        .replace('__VERSAO__', versao)
        .replace('__PRECACHE__', JSON.stringify(precache))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: fonte })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  optimizeDeps: {
    include: ['recharts', 'recharts/es6/component/DefaultLegendContent'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
