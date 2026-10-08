import { WifiOff } from 'lucide-react'
import { useOnline } from '@/lib/pwa'

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-sm font-medium text-amber-950">
      <WifiOff className="h-4 w-4" aria-hidden />
      Você está offline. Mostrando o que já foi carregado.
    </div>
  )
}
