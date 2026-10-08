import { Download } from 'lucide-react'
import { useInstalarApp } from '@/lib/pwa'
import { IconButton } from '@/components/ui/Button'

/** Botão "Instalar app": só aparece quando o navegador oferece a instalação. */
export function InstallButton({ variant = 'full' }: { variant?: 'full' | 'icon' }) {
  const instalar = useInstalarApp()
  if (!instalar) return null
  if (variant === 'icon')
    return (
      <IconButton onClick={instalar} aria-label="Instalar app" title="Instalar app">
        <Download className="h-5 w-5" />
      </IconButton>
    )
  return (
    <button
      type="button"
      onClick={instalar}
      className="flex w-full items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-200 dark:hover:bg-brand-950"
    >
      <Download className="h-5 w-5" aria-hidden />
      Instalar app
    </button>
  )
}
