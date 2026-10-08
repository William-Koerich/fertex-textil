import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Expõe ao front apenas as variáveis NEXT_PUBLIC_* (DATABASE_URL nunca vai para o bundle)
  envPrefix: 'NEXT_PUBLIC_',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@db': fileURLToPath(new URL('./db', import.meta.url)),
    },
  },
})
