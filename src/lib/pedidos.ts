import type { ItemCarrinho } from '@/contexts/CartContext'
import type { OrigemPedido, Pedido } from '@db/schema'
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
  /** nome do comprador (loja) ou do cliente informado na venda direta; null se não informado */
  comprador_nome: string | null
  origem: OrigemPedido
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

/** Venda feita fora do app (balcão, WhatsApp…), registrada pelo vendedor. Baixa o estoque. */
export async function registrarVenda(input: { produtoId: string; quantidade: number; clienteNome?: string; precoUnitario?: number }) {
  const { data, error } = await supabase.rpc('fertex_registrar_venda', {
    p_produto_id: input.produtoId,
    p_quantidade: input.quantidade,
    p_cliente_nome: input.clienteNome?.trim() || null,
    p_preco_unitario: input.precoUnitario ?? null,
  })
  if (error) throw error
  return data as string
}
