import { useId } from 'react'
import { FORMAS_PAGAMENTO, temPrazo } from '@/lib/pagamento'
import type { Pagamento } from '@/lib/pagamento'
import { inputClass } from '@/components/ui/Field'

/** Forma de pagamento (Pix, Dinheiro, Boleto, Cheque) + prazo em dias quando for Boleto ou Cheque. */
export function CampoPagamento({ valor, onChange, erro }: { valor: Pagamento; onChange: (v: Pagamento) => void; erro?: string | null }) {
  const id = useId()
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Forma de pagamento</legend>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Forma de pagamento">
          {FORMAS_PAGAMENTO.map((f) => {
            const sel = valor.forma === f.valor
            return (
              <button
                key={f.valor}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => onChange({ forma: f.valor, prazo: temPrazo(f.valor) ? valor.prazo : '' })}
                className={`rounded-lg border-2 px-2 py-2 text-sm font-semibold transition-colors ${
                  sel
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </fieldset>
      {temPrazo(valor.forma) && (
        <div className="space-y-1.5">
          <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Prazo do {valor.forma} (dias)
          </label>
          <input
            id={id}
            inputMode="numeric"
            placeholder="30/60/90"
            autoComplete="off"
            value={valor.prazo}
            onChange={(e) => onChange({ ...valor, prazo: e.target.value.replace(/[^0-9/ ,;-]/g, '') })}
            aria-describedby={`${id}-ajuda`}
            className={inputClass(!!erro && /prazo/i.test(erro))}
          />
          <p id={`${id}-ajuda`} className="text-xs text-slate-500 dark:text-slate-400">
            Um prazo (30) ou várias parcelas separadas por barra (30/60/90).
          </p>
        </div>
      )}
      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
    </div>
  )
}
