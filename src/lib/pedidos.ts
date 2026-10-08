import type { ItemCarrinho } from '@/contexts/CartContext'
import type { Pedido } from '@db/schema'
import { supabase } from './supabase'

/** Chama a RPC transacional fertex_finalizar_compra. Retorna o id do pedido criado. */
export async function finalizarCompra(itens: ItemCarrinho[]): Promise<string> {
  const { data, error } = await supabase.rpc('fertex_finalizar_compra', {
    p_itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
  })
  if (error) throw error
  return data as string
}

export interface Venda {
  item_id: string
  pedido_id: string
  data: string
  produto_id: string
  produto_nome: string
  comprador_nome: string
  quantidade: number
  preco_unitario: number
  total: number
}

/** Vendas do vendedor logado. Datas no formato AAAA-MM-DD (inclusivas). */
export async function listarVendas(filtro: { inicio?: string; fim?: string; produtoId?: string }) {
  const { data, error } = await supabase.rpc('fertex_vendas_vendedor', {
    p_inicio: filtro.inicio || null,
    p_fim: filtro.fim || null,
    p_produto_id: filtro.produtoId || null,
  })
  if (error) throw error
  return (data ?? []) as Venda[]
}

export interface PedidoComItens extends Pedido {
  itens: {
    id: string
    produto_id: string
    quantidade: number
    preco_unitario: number
    produto: { nome: string; foto_url: string | null } | null
  }[]
}

export async function listarMeusPedidos() {
  const { data, error } = await supabase
    .from('fertex_pedidos')
    .select('*, itens:fertex_itens_pedido(id, produto_id, quantidade, preco_unitario, produto:fertex_produtos(nome, foto_url))')
    .order('criado_em', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as unknown as PedidoComItens[]
}
