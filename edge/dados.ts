/**
 * Dados públicos para a prévia de links (Vercel Edge: api/og.ts e middleware.ts).
 * Usa a mesma chave publicável do site, então só enxerga o que a RLS libera para visitantes
 * (produtos ativos e nome dos vendedores).
 */

export interface ProdutoPublico {
  id: string
  nome: string
  descricao: string
  preco: number
  unidade: string
  quantidade_minima: number | null
  cores: string[]
  categoria: string
  foto_url: string | null
  estoque: number
  vendedor_id: string
}

const env = (k: string) => (typeof process !== 'undefined' ? process.env[k] : undefined)

function config() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  if (!url || !key) throw new Error('Variáveis NEXT_PUBLIC_SUPABASE_* não configuradas')
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ehUuid = (v: string | null | undefined): v is string => !!v && UUID.test(v)

const CAMPOS = 'id,nome,descricao,preco,unidade,quantidade_minima,cores,categoria,foto_url,estoque,vendedor_id'

export async function buscarProduto(id: string): Promise<ProdutoPublico | null> {
  if (!ehUuid(id)) return null
  const { url, headers } = config()
  const r = await fetch(`${url}/rest/v1/fertex_produtos?id=eq.${id}&ativo=eq.true&excluido_em=is.null&select=${CAMPOS}`, { headers })
  if (!r.ok) return null
  const [p] = (await r.json()) as ProdutoPublico[]
  return p ?? null
}

export async function produtosDoVendedor(vendedorId: string | null, limite = 6): Promise<ProdutoPublico[]> {
  const { url, headers } = config()
  const filtro = ehUuid(vendedorId) ? `&vendedor_id=eq.${vendedorId}` : ''
  const r = await fetch(
    `${url}/rest/v1/fertex_produtos?ativo=eq.true&excluido_em=is.null${filtro}&select=${CAMPOS}&order=criado_em.desc&limit=${limite}`,
    { headers },
  )
  return r.ok ? ((await r.json()) as ProdutoPublico[]) : []
}

export async function contarProdutos(vendedorId: string | null): Promise<number> {
  const { url, headers } = config()
  const filtro = ehUuid(vendedorId) ? `&vendedor_id=eq.${vendedorId}` : ''
  const r = await fetch(`${url}/rest/v1/fertex_produtos?ativo=eq.true&excluido_em=is.null${filtro}&select=id`, {
    headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
  })
  const total = r.headers.get('content-range')?.split('/')[1]
  return total ? Number(total) : 0
}

export interface VendedorPublico {
  id: string
  nome: string
  whatsapp: string | null
}

/**
 * Nome e WhatsApp (público) do vendedor. Sem id (loja geral): se só existe um vendedor com produtos,
 * devolve ele — assim o catálogo geral também mostra o contato.
 */
export async function vendedorPublico(id: string | null | undefined): Promise<VendedorPublico | null> {
  const { url, headers } = config()
  const r = await fetch(`${url}/rest/v1/rpc/fertex_vendedores_publicos`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!r.ok) return null
  const lista = (await r.json()) as VendedorPublico[]
  if (ehUuid(id)) return lista.find((v) => v.id === id) ?? null
  return lista.length === 1 ? lista[0] : null
}

export async function nomeDoVendedor(id: string | null | undefined): Promise<string | null> {
  return ehUuid(id) ? ((await vendedorPublico(id))?.nome ?? null) : null
}

/** "5547996637188" → "(47) 99663-7188" (números de fora do Brasil: +DDI…) */
export function formatarTelefone(d: string | null | undefined): string | null {
  if (!d) return null
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${d}`
}

// ---------- formatação (sem depender do código do app) ----------

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const UNIDADE: Record<string, { por: string; singular: string; plural: string }> = {
  kg: { por: 'kg', singular: 'kg', plural: 'kg' },
  litro: { por: 'L', singular: 'L', plural: 'L' },
  saco: { por: 'saco', singular: 'saco', plural: 'sacos' },
  unidade: { por: 'un.', singular: 'un.', plural: 'un.' },
  caixa: { por: 'caixa', singular: 'caixa', plural: 'caixas' },
  rolo: { por: 'rolo', singular: 'rolo', plural: 'rolos' },
  metro: { por: 'm', singular: 'm', plural: 'm' },
}
const u = (x: string) => UNIDADE[x] ?? UNIDADE.unidade

export const precoPor = (p: Pick<ProdutoPublico, 'preco' | 'unidade'>) => `${moeda.format(p.preco)}/${u(p.unidade).por}`.replace(/ /g, ' ')

export function textoMinimo(p: Pick<ProdutoPublico, 'quantidade_minima' | 'unidade' | 'cores'>) {
  if (!p.quantidade_minima || p.quantidade_minima <= 1) return null
  const un = u(p.unidade)
  const q = `${p.quantidade_minima.toLocaleString('pt-BR')} ${p.quantidade_minima === 1 ? un.singular : un.plural}`
  return `Pedido mínimo: ${q}${p.cores?.length ? ' por cor' : ''}`
}

export function textoCores(cores: string[], max = 4) {
  if (!cores?.length) return null
  const lista = cores.slice(0, max).join(', ')
  return cores.length > max ? `${lista} e mais ${cores.length - max}` : lista
}
