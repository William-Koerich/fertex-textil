import type { Produto } from '@db/schema'
import { BUCKET_PRODUTOS, supabase } from './supabase'
import { redimensionarImagem } from './imagem'
import { AppError } from './errors'

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

export type ProdutoInput = Pick<Produto, 'nome' | 'descricao' | 'preco' | 'estoque' | 'categoria' | 'ativo'>

export async function listarMeusProdutos(vendedorId: string) {
  const { data, error } = await supabase
    .from('fertex_produtos')
    .select('*')
    .eq('vendedor_id', vendedorId)
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

export async function excluirProduto(produto: Produto) {
  const { error, count } = await supabase.from('fertex_produtos').delete({ count: 'exact' }).eq('id', produto.id)
  if (error) {
    if (error.code === '23503')
      throw new AppError('Este produto já tem vendas e não pode ser excluído. Desative-o para tirá-lo da vitrine.')
    throw error
  }
  if (!count) throw { code: '42501' }
  await removerFoto(produto.foto_url)
}
