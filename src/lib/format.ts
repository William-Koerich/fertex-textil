const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = new Intl.NumberFormat('pt-BR')
const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

export const formatarMoeda = (v: number) => moeda.format(v)
export const formatarNumero = (v: number) => numero.format(v)
export const formatarData = (v: string | Date) => data.format(new Date(v))
export const formatarDataHora = (v: string | Date) => dataHora.format(new Date(v))
export const formatarDiaMes = (v: string | Date) => diaMes.format(new Date(v))

/** Converte "1.234,56" ou "1234.56" em número. Retorna NaN se inválido. */
export function parseMoeda(texto: string): number {
  const limpo = texto.replace(/[R$\s]/g, '')
  if (!limpo) return NaN
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  return /^\d+(\.\d{1,2})?$/.test(normalizado) ? Number(normalizado) : NaN
}

/** Data local no formato AAAA-MM-DD (para inputs type="date"). */
export function dataISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}
