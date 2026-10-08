import { Minus, Plus } from 'lucide-react'

interface Props {
  value: number
  min?: number
  max: number
  onChange: (v: number) => void
  label: string
  size?: 'sm' | 'md'
}

export function QuantityStepper({ value, min = 1, max, onChange, label, size = 'md' }: Props) {
  const btn = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11'
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900" role="group" aria-label={label}>
      <button
        type="button"
        className={`${btn} inline-flex items-center justify-center rounded-l-lg hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800`}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Diminuir quantidade"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.floor(n))))
        }}
        aria-label="Quantidade"
        className={`${size === 'sm' ? 'w-10 text-sm' : 'w-12'} [appearance:textfield] border-x border-slate-300 bg-transparent py-1 text-center font-semibold focus:outline-none dark:border-slate-700 [&::-webkit-inner-spin-button]:appearance-none`}
      />
      <button
        type="button"
        className={`${btn} inline-flex items-center justify-center rounded-r-lg hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800`}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Aumentar quantidade"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
