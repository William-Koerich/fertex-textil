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

const moedaCompacta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })
const diaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
const mesNome = new Intl.DateTimeFormat('pt-BR', { month: 'long' })

/** "AAAA-MM-DD" é interpretado como data LOCAL (new Date("2026-10-08") seria meia-noite UTC = dia anterior no Brasil). */
function paraData(v: string | Date) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(v)
}

export const formatarMoeda = (v: number) => moeda.format(v)
export const formatarMoedaCompacta = (v: number) => (Math.abs(v) < 1000 ? moeda.format(v).replace(/,00$/, '') : moedaCompacta.format(v))
export const formatarDiaSemana = (v: string | Date) => diaSemana.format(paraData(v))
export const formatarMes = (v: string | Date) => mesNome.format(paraData(v))
export const formatarNumero = (v: number) => numero.format(v)
export const formatarData = (v: string | Date) => data.format(paraData(v))
export const formatarDataHora = (v: string | Date) => dataHora.format(new Date(v))
export const formatarDiaMes = (v: string | Date) => diaMes.format(paraData(v))

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
