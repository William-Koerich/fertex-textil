import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, TriangleAlert, X } from 'lucide-react'

type Tipo = 'sucesso' | 'erro'
interface Toast {
  id: number
  tipo: Tipo
  texto: string
}

const ToastContext = createContext<((texto: string, tipo?: Tipo) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remover = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const mostrar = useCallback(
    (texto: string, tipo: Tipo = 'sucesso') => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t.slice(-2), { id, tipo, texto }])
      setTimeout(() => remover(id), 4000)
    },
    [remover],
  )

  const value = useMemo(() => mostrar, [mostrar])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tipo === 'erro' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
              t.tipo === 'erro' ? 'bg-red-600' : 'bg-slate-900 dark:bg-slate-700'
            }`}
          >
            {t.tipo === 'erro' ? (
              <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <Check className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
            )}
            <span className="flex-1">{t.texto}</span>
            <button type="button" onClick={() => remover(t.id)} aria-label="Fechar aviso" className="opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}
