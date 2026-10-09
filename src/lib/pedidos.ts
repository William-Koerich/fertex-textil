import type { ItemCarrinho } from '@/contexts/CartContext'
import type { OrigemPedido, StatusPedido } from '@db/schema'
import { supabase } from './supabase'

/** Rótulo e cores de cada situação do pedido */
export const STATUS_PEDIDO: Record<StatusPedido, { label: string; cls: string }> = {
  pendente: { label: 'Aguardando confirmação', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  concluido: { label: 'Vendido', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
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

/** Vendas concluídas do vendedor logado. Datas no formato AAAA-MM-DD (inclusivas). */
export async function listarVendas(filtro: { inicio?: string; fim?: string; produtoId?: string }) {
  const { data, error } = await supabase.rpc('fertex_vendas_vendedor', {
    p_inicio: filtro.inicio || null,
    p_fim: filtro.fim || null,
    p_produto_id: filtro.produtoId || null,
  })
  if (error) throw error
  return (data ?? []) as Venda[]
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

// ---------------------------------------------------------------------------
// Pedidos pelo WhatsApp
// ---------------------------------------------------------------------------

export interface PedidoEnviado {
  pedido_id: string
  vendedor_nome: string
  whatsapp: string
  total: number
  itens: { nome: string; quantidade: number; preco_unitario: number }[]
}

/** Cria um pedido pendente por vendedor (sem baixar estoque) e devolve os dados para o WhatsApp. */
export async function enviarPedidoWhatsapp(itens: ItemCarrinho[], observacao: string) {
  const { data, error } = await supabase.rpc('fertex_enviar_pedido_whatsapp', {
    p_itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
    p_observacao: observacao.trim() || null,
  })
  if (error) throw error
  return data as PedidoEnviado[]
}

interface ItemDoPedido {
  produto_id: string
  nome: string
  foto_url: string | null
  quantidade: number
  preco_unitario: number
}

export interface MeuPedido {
  id: string
  status: StatusPedido
  origem: OrigemPedido
  total: number
  observacao: string | null
  criado_em: string
  concluido_em: string | null
  vendedor_nome: string | null
  vendedor_whatsapp: string | null
  itens: (ItemDoPedido & { id: string })[]
}

export async function listarMeusPedidos() {
  const { data, error } = await supabase.rpc('fertex_meus_pedidos')
  if (error) throw error
  return (data ?? []) as MeuPedido[]
}

export interface PedidoRecebido {
  id: string
  status: StatusPedido
  origem: OrigemPedido
  total: number
  observacao: string | null
  criado_em: string
  concluido_em: string | null
  comprador_nome: string | null
  itens: (ItemDoPedido & { estoque: number })[]
}

export async function listarPedidosRecebidos() {
  const { data, error } = await supabase.rpc('fertex_pedidos_recebidos', {})
  if (error) throw error
  return (data ?? []) as PedidoRecebido[]
}

/** Quantidade de pedidos aguardando confirmação (badge do menu do vendedor). */
export async function contarPedidosPendentes() {
  const { data, error } = await supabase.rpc('fertex_pedidos_recebidos', { p_status: 'pendente' })
  if (error) throw error
  return ((data ?? []) as unknown[]).length
}

export async function concluirPedido(id: string) {
  const { error } = await supabase.rpc('fertex_concluir_pedido', { p_pedido_id: id })
  if (error) throw error
}

export async function cancelarPedido(id: string) {
  const { error } = await supabase.rpc('fertex_cancelar_pedido', { p_pedido_id: id })
  if (error) throw error
}
