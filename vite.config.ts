import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

/** Em desenvolvimento, serve /api/og (função da Vercel) para ver a prévia de compartilhamento localmente */
function apiOgLocal(): Plugin {
  return {
    name: 'fertex-api-og-local',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/og', async (req, res) => {
        try {
          const env = loadEnv('development', process.cwd(), 'NEXT_PUBLIC_')
          Object.assign(process.env, env)
          // Recarrega sempre a versão atual (o arquivo fica fora de src e pode não ser invalidado sozinho)
          server.moduleGraph.invalidateAll()
          const { default: handler } = await server.ssrLoadModule('/api/og.ts')
          const resposta: Response = await handler(new Request(`http://localhost${req.originalUrl}`))
          res.statusCode = resposta.status
          resposta.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await resposta.arrayBuffer()))
        } catch (e) {
          res.statusCode = 500
          res.end(String(e))
        }
      })
    },
  }
}

export default defineConfig({
  // Expõe ao front apenas as variáveis NEXT_PUBLIC_* (DATABASE_URL nunca vai para o bundle)
  envPrefix: 'NEXT_PUBLIC_',
  plugins: [
    apiOgLocal(),
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
