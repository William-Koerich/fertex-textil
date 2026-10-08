import { dataISO } from '@/lib/format'
import { inputClass } from '@/components/ui/Field'

export type Preset = 'hoje' | '7' | '30' | '90' | 'mes' | 'tudo' | 'custom'

export const PRESETS: { valor: Preset; label: string }[] = [
  { valor: 'hoje', label: 'Hoje' },
  { valor: '7', label: '7 dias' },
  { valor: '30', label: '30 dias' },
  { valor: 'mes', label: 'Este mês' },
  { valor: '90', label: '90 dias' },
  { valor: 'tudo', label: 'Tudo' },
  { valor: 'custom', label: 'Personalizado' },
]

/** Converte um preset em intervalo [inicio, fim] (AAAA-MM-DD, inclusivo). */
export function intervaloDoPreset(p: Preset, inicio = '', fim = ''): { inicio: string; fim: string } {
  const hoje = new Date()
  const menos = (dias: number) => {
    const d = new Date(hoje)
    d.setDate(d.getDate() - dias)
    return dataISO(d)
  }
  switch (p) {
    case 'hoje':
      return { inicio: dataISO(hoje), fim: dataISO(hoje) }
    case '7':
      return { inicio: menos(6), fim: dataISO(hoje) }
    case '30':
      return { inicio: menos(29), fim: dataISO(hoje) }
    case '90':
      return { inicio: menos(89), fim: dataISO(hoje) }
    case 'mes':
      return { inicio: dataISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: dataISO(hoje) }
    case 'tudo':
      return { inicio: '', fim: '' }
    case 'custom':
      return { inicio, fim }
  }
}

interface Props {
  preset: Preset
  inicio: string
  fim: string
  onChange: (v: { preset: Preset; inicio: string; fim: string }) => void
}

export function PeriodoFiltro({ preset, inicio, fim, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Período">
        {PRESETS.map((p) => (
          <button
            key={p.valor}
            type="button"
            aria-pressed={preset === p.valor}
            onClick={() => {
              const r = intervaloDoPreset(p.valor, inicio, fim)
              onChange({ preset: p.valor, ...r })
            }}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              preset === p.valor
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">De</span>
            <input
              type="date"
              value={inicio}
              max={fim || undefined}
              onChange={(e) => onChange({ preset, inicio: e.target.value, fim })}
              className={inputClass()}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Até</span>
            <input
              type="date"
              value={fim}
              min={inicio || undefined}
              onChange={(e) => onChange({ preset, inicio, fim: e.target.value })}
              className={inputClass()}
            />
          </label>
        </div>
      )}
    </div>
  )
}
