import type { FormaPagamento } from '@db/schema'

export type { FormaPagamento }

export const FORMAS_PAGAMENTO: { valor: FormaPagamento; label: string }[] = [
  { valor: 'pix', label: 'Pix' },
  { valor: 'dinheiro', label: 'Dinheiro' },
  { valor: 'boleto', label: 'Boleto' },
  { valor: 'cheque', label: 'Cheque' },
]

export const temPrazo = (f: FormaPagamento | '' | null | undefined) => f === 'boleto' || f === 'cheque'

/** "30 60, 90" → "30/60/90" (mesma regra do banco) */
export const normalizarPrazo = (p: string) => p.replace(/[^0-9]+/g, '/').replace(/^\/+|\/+$/g, '')

export interface Pagamento {
  forma: FormaPagamento | ''
  prazo: string
}

/** Mensagem de erro, ou null se estiver tudo certo */
export function validarPagamento(p: Pagamento): string | null {
  if (!p.forma) return 'Escolha a forma de pagamento.'
  if (!temPrazo(p.forma)) return null
  const prazo = normalizarPrazo(p.prazo)
  if (!prazo) return `Informe o prazo do ${p.forma} em dias (ex.: 30/60/90).`
  if (!/^\d{1,3}(\/\d{1,3}){0,11}$/.test(prazo)) return 'Prazo inválido. Use os dias separados por barra, ex.: 30/60/90.'
  return null
}

/** "Pix", "Boleto 30/60/90 dias", "—" */
export function formatarPagamento(forma: FormaPagamento | null | undefined, prazo?: string | null) {
  if (!forma) return '—'
  const label = FORMAS_PAGAMENTO.find((f) => f.valor === forma)?.label ?? forma
  return prazo ? `${label} ${prazo} dias` : label
}
