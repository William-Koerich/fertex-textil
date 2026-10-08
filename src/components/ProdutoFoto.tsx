import { useState } from 'react'
import { Package } from 'lucide-react'

export function ProdutoFoto({ url, nome, className = '' }: { url: string | null; nome: string; className?: string }) {
  const [falhou, setFalhou] = useState(false)
  if (!url || falhou) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 ${className}`}
        role="img"
        aria-label={`Sem foto: ${nome}`}
      >
        <Package className="h-1/3 max-h-12 w-1/3 max-w-12" aria-hidden />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={nome}
      loading="lazy"
      decoding="async"
      onError={() => setFalhou(true)}
      className={`bg-slate-100 object-cover dark:bg-slate-800 ${className}`}
    />
  )
}
