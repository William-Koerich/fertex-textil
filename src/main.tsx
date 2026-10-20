import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from '@/router'
import './index.css'
// Captura o evento de instalação o quanto antes
import '@/lib/pwa'
import { recuperarVersao } from '@/lib/recuperarVersao'

// Trecho do app que não baixou (geralmente logo após uma nova publicação): tenta de novo e recarrega
window.addEventListener('vite:preloadError', (e) => {
  if (recuperarVersao((e as Event & { payload?: unknown }).payload)) e.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
