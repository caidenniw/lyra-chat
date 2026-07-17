import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: samakan perilaku dengan server.js produksi — root menyajikan landing page,
// app React tetap di /chat (SPA fallback Vite).
function landingAtRoot(): Plugin {
  return {
    name: 'landing-at-root',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = (req.url || '').split('?')[0]
        if (url === '/' || url === '/index.html') req.url = '/landing/index.html'
        else if (url === '/privacy') req.url = '/landing/privacy.html'
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), landingAtRoot()],
  server: {
    port: 5200,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  worker: {
    format: 'es',
  },
})
