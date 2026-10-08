import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import type { Tema } from '@/contexts/ThemeContext'
import { IconButton } from '@/components/ui/Button'

const OPCOES: { valor: Tema; label: string; icon: typeof Sun }[] = [
  { valor: 'claro', label: 'Claro', icon: Sun },
  { valor: 'escuro', label: 'Escuro', icon: Moon },
  { valor: 'sistema', label: 'Sistema', icon: Monitor },
]

/** Botão único que alterna claro → escuro → sistema (usado no topo do celular e nas telas de login). */
export function ThemeToggleButton() {
  const { tema, alternar } = useTheme()
  const atual = OPCOES.find((o) => o.valor === tema)!
  const proximo = OPCOES[(OPCOES.indexOf(atual) + 1) % OPCOES.length]
  const Icone = atual.icon
  return (
    <IconButton onClick={alternar} aria-label={`Tema: ${atual.label}. Mudar para ${proximo.label.toLowerCase()}`} title={`Tema: ${atual.label}`}>
      <Icone className="h-5 w-5" />
    </IconButton>
  )
}

/** Seletor segmentado (menu lateral no desktop). */
export function ThemeSegmented() {
  const { tema, setTema } = useTheme()
  return (
    <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label="Tema">
      {OPCOES.map(({ valor, label, icon: Icone }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={tema === valor}
          onClick={() => setTema(valor)}
          title={label}
          className={`flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tema === valor
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Icone className="h-3.5 w-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}
