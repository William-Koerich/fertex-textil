import type { Unidade } from '@db/schema'
import { formatarMoeda, formatarNumero } from './format'

export type { Unidade }

interface InfoUnidade {
  valor: Unidade
  /** rótulo no cadastro do produto */
  label: string
  /** usado depois do preço: "R$ 27,00/kg" */
  por: string
  singular: string
  plural: string
}

export const UNIDADES: InfoUnidade[] = [
  { valor: 'kg', label: 'Quilo (kg)', por: 'kg', singular: 'kg', plural: 'kg' },
  { valor: 'litro', label: 'Litro (L)', por: 'L', singular: 'L', plural: 'L' },
  { valor: 'saco', label: 'Saco', por: 'saco', singular: 'saco', plural: 'sacos' },
  { valor: 'unidade', label: 'Unidade', por: 'un.', singular: 'un.', plural: 'un.' },
  { valor: 'caixa', label: 'Caixa', por: 'caixa', singular: 'caixa', plural: 'caixas' },
  { valor: 'rolo', label: 'Rolo', por: 'rolo', singular: 'rolo', plural: 'rolos' },
  { valor: 'metro', label: 'Metro (m)', por: 'm', singular: 'm', plural: 'm' },
]

const porValor = new Map(UNIDADES.map((u) => [u.valor, u]))
const info = (u: Unidade | null | undefined) => porValor.get(u ?? 'unidade') ?? porValor.get('unidade')!

/** "2 kg", "1 saco", "3 sacos", "10 un." */
export const formatarQuantidade = (n: number, u: Unidade | null | undefined) =>
  `${formatarNumero(n)} ${n === 1 ? info(u).singular : info(u).plural}`

/** "R$ 27,00/kg" */
export const formatarPrecoPor = (preco: number, u: Unidade | null | undefined) => `${formatarMoeda(preco)}/${info(u).por}`

/** "kg", "saco", "un." — para rótulos como "Preço por kg" */
export const siglaUnidade = (u: Unidade | null | undefined) => info(u).por
