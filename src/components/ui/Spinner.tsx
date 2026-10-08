import { LoaderCircle } from 'lucide-react'

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return <LoaderCircle className={`animate-spin ${className}`} aria-hidden />
}

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
      <Spinner className="h-8 w-8 text-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function FullScreenLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <LoadingState />
    </div>
  )
}
