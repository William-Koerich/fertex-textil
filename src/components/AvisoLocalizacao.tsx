import { MapPin, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLocalizacaoVisitante } from '@/lib/localizacao'

/** Pede autorização para usar a localização (GPS) do visitante, explicando o motivo antes do pedido do navegador. */
export function AvisoLocalizacao() {
  const { profile, loading } = useAuth()
  const { mostrarAviso, permitir, recusar } = useLocalizacaoVisitante(!loading && profile?.perfil !== 'vendedor')
  if (!mostrarAviso) return null
  return (
    <div
      role="dialog"
      aria-labelledby="titulo-localizacao"
      aria-describedby="texto-localizacao"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:right-6 md:bottom-6 md:left-auto md:mx-0 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
          <MapPin className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p id="titulo-localizacao" className="font-semibold">
            Usar sua localização?
          </p>
          <p id="texto-localizacao" className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Assim sabemos de quais cidades e bairros vêm nossos clientes. Usamos só para estatísticas e guardamos apenas a região
            aproximada, nunca o seu endereço.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={permitir}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Permitir
            </button>
            <button
              type="button"
              onClick={recusar}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Agora não
            </button>
          </div>
        </div>
        <button type="button" onClick={recusar} aria-label="Fechar" className="-mt-1 -mr-1 h-8 w-8 shrink-0 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="mx-auto h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
