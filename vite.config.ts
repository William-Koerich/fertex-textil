import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Expõe ao front apenas as variáveis NEXT_PUBLIC_* (DATABASE_URL nunca vai para o bundle)
  envPrefix: 'NEXT_PUBLIC_',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": o usuário decide quando atualizar (aviso de nova versão em UpdatePrompt.tsx)
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'robots.txt', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Fertex Vendas',
        short_name: 'Fertex',
        description: 'Acelerador de vendas: cadastre produtos, venda e acompanhe seus resultados.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        categories: ['business', 'shopping', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Loja', url: '/loja', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Painel do vendedor', url: '/painel', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // App shell: todo o JS/CSS/HTML/ícones do build fica em cache
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Fotos dos produtos (Supabase Storage público): cache para navegar offline
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/public/fertex-produtos/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fertex-fotos',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@db': fileURLToPath(new URL('./db', import.meta.url)),
    },
  },
})
