import type { Produto } from '@db/schema'
import { BUCKET_PRODUTOS, supabase } from './supabase'
import { redimensionarImagem } from './imagem'

export type { Produto }

export const CATEGORIAS_SUGERIDAS = [
  'Tecidos',
  'Malhas',
  'Aviamentos',
  'Linhas e fios',
  'Cama, mesa e banho',
  'Vestuário',
  'Acessórios',
  'Outros',
]

export const ESTOQUE_BAIXO = 5

/** O comprador só consegue pedir se o estoque cobre a quantidade mínima por pedido. */
export const atendeMinimo = (p: Pick<Produto, 'estoque' | 'quantidade_minima'>) => p.estoque >= (p.quantidade_minima ?? 1)

export type ProdutoInput = Pick<Produto, 'nome' | 'descricao' | 'preco' | 'estoque' | 'unidade' | 'quantidade_minima' | 'cores' | 'categoria' | 'ativo'>

export async function listarMeusProdutos(vendedorId: string) {
  const { data, error } = await supabase
    .from('fertex_produtos')
    .select('*')
    .eq('vendedor_id', vendedorId)
    .is('excluido_em', null)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data as Produto[]
}

export async function buscarProduto(id: string) {
  const { data, error } = await supabase.from('fertex_produtos').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Produto | null
}

export async function listarProdutosAtivos() {
  const { data, error } = await supabase
    .from('fertex_produtos')
    .select('*')
    .eq('ativo', true)
    .is('excluido_em', null)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data as Produto[]
}

/** Envia a foto (redimensionada) para o Storage na pasta do vendedor e devolve a URL pública. */
export async function enviarFoto(vendedorId: string, arquivo: File) {
  const blob = await redimensionarImagem(arquivo)
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const caminho = `${vendedorId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET_PRODUTOS)
    .upload(caminho, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return supabase.storage.from(BUCKET_PRODUTOS).getPublicUrl(caminho).data.publicUrl
}

/** Remove do Storage uma foto a partir da URL pública (falhas são ignoradas). */
export async function removerFoto(url: string | null | undefined) {
  if (!url) return
  const marcador = `/object/public/${BUCKET_PRODUTOS}/`
  const i = url.indexOf(marcador)
  if (i < 0) return
  await supabase.storage.from(BUCKET_PRODUTOS).remove([decodeURIComponent(url.slice(i + marcador.length))])
}

export async function criarProduto(vendedorId: string, input: ProdutoInput & { foto_url: string | null }) {
  const { data, error } = await supabase
    .from('fertex_produtos')
    .insert({ ...input, vendedor_id: vendedorId })
    .select()
    .single()
  if (error) throw error
  return data as Produto
}

export async function atualizarProduto(id: string, input: Partial<ProdutoInput> & { foto_url?: string | null }) {
  const { data, error } = await supabase.from('fertex_produtos').update(input).eq('id', id).select().maybeSingle()
  if (error) throw error
  if (!data) throw { code: '42501' }
  return data as Produto
}

/**
 * Exclui o produto. Se ele já tem vendas, não dá para apagar do banco sem perder o histórico:
 * nesse caso ele é marcado como excluído (some da lista e da loja) e as vendas continuam no painel.
 * Retorna 'apagado' ou 'arquivado'.
 */
export async function excluirProduto(produto: Produto): Promise<'apagado' | 'arquivado'> {
  const { error, count } = await supabase.from('fertex_produtos').delete({ count: 'exact' }).eq('id', produto.id)
  if (error?.code === '23503') {
    const r = await supabase
      .from('fertex_produtos')
      .update({ excluido_em: new Date().toISOString(), ativo: false })
      .eq('id', produto.id)
      .select('id')
    if (r.error) throw r.error
    if (!r.data?.length) throw { code: '42501' }
    return 'arquivado'
  }
  if (error) throw error
  if (!count) throw { code: '42501' }
  await removerFoto(produto.foto_url)
  return 'apagado'
}
