import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { PackageOpen, TriangleAlert, WifiOff } from 'lucide-react'
import { useOnline } from '@/lib/pwa'
import { MSG_SEM_CONEXAO } from '@/lib/errors'
import type { LucideIcon } from 'lucide-react'
import { Button } from './Button'

export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
      <Icon className="h-10 w-10 text-slate-400" aria-hidden />
      <h2 className="mt-1 font-semibold">{title}</h2>
      {description && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const online = useOnline()

  // Ao voltar a conexão, tenta de novo automaticamente
  useEffect(() => {
    if (!onRetry) return
    window.addEventListener('online', onRetry)
    return () => window.removeEventListener('online', onRetry)
  }, [onRetry])

  // navigator.onLine nem sempre é confiável (ex.: Wi-Fi sem internet): também trata falha de rede como offline
  if (!online || message === MSG_SEM_CONEXAO)
    return (
      <div role="status" className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
          <WifiOff className="h-8 w-8 text-amber-600 dark:text-amber-400" aria-hidden />
        </div>
        <h2 className="mt-2 font-semibold">Sem conexão com a internet</h2>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Não conseguimos carregar estes dados agora. Assim que a conexão voltar, tentaremos de novo automaticamente.
        </p>
        {onRetry && (
          <Button variant="secondary" className="mt-3" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    )

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900 dark:bg-red-950/40"
    >
      <TriangleAlert className="h-10 w-10 text-red-500" aria-hidden />
      <h2 className="mt-1 font-semibold text-red-800 dark:text-red-200">Algo deu errado</h2>
      <p className="max-w-sm text-sm text-red-700 dark:text-red-300">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    info: 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-200',
  }[kind]
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  )
}
