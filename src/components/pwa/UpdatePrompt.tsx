import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

const UMA_HORA = 60 * 60 * 1000

/** Registra o service worker e avisa quando há uma nova versão (ou quando o app está pronto para uso offline). */
export function UpdatePrompt() {
  const {
    needRefresh: [novaVersao, setNovaVersao],
    offlineReady: [prontoOffline, setProntoOffline],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      // Verifica atualizações periodicamente enquanto o app fica aberto
      if (registro) setInterval(() => navigator.onLine && registro.update(), UMA_HORA)
    },
  })

  useEffect(() => {
    if (!prontoOffline) return
    const t = setTimeout(() => setProntoOffline(false), 5000)
    return () => clearTimeout(t)
  }, [prontoOffline, setProntoOffline])

  if (!novaVersao && !prontoOffline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-2 z-50 mx-auto flex w-[calc(100%-2rem)] max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-700"
    >
      <RefreshCw className="h-5 w-5 shrink-0 text-brand-300" aria-hidden />
      <span className="flex-1">{novaVersao ? 'Nova versão disponível.' : 'App pronto para funcionar offline.'}</span>
      {novaVersao && (
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="rounded-lg bg-brand-500 px-3 py-1.5 font-semibold hover:bg-brand-400"
        >
          Atualizar
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setNovaVersao(false)
          setProntoOffline(false)
        }}
        aria-label="Fechar"
        className="opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
