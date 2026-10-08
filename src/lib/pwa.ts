import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// O evento pode disparar antes do React montar: capturamos já no carregamento do módulo.
let promptEvent: BeforeInstallPromptEvent | null = null
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // mostramos nosso próprio botão "Instalar app"
    promptEvent = e as BeforeInstallPromptEvent
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    promptEvent = null
    avisar()
  })
}

const assinar = (f: () => void) => {
  ouvintes.add(f)
  return () => ouvintes.delete(f)
}

/** Retorna a função de instalação quando o navegador permite instalar; senão null. */
export function useInstalarApp() {
  const evento = useSyncExternalStore(assinar, () => promptEvent)
  if (!evento) return null
  return async () => {
    await evento.prompt()
    await evento.userChoice
    promptEvent = null
    avisar()
  }
}

const assinarOnline = (f: () => void) => {
  window.addEventListener('online', f)
  window.addEventListener('offline', f)
  return () => {
    window.removeEventListener('online', f)
    window.removeEventListener('offline', f)
  }
}

export function useOnline() {
  return useSyncExternalStore(assinarOnline, () => navigator.onLine)
}
