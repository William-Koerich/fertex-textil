import type { ItemCarrinho } from '@/contexts/CartContext'
import { supabase } from './supabase'

/** Chama a RPC transacional fertex_finalizar_compra. Retorna o id do pedido criado. */
export async function finalizarCompra(itens: ItemCarrinho[]): Promise<string> {
  const { data, error } = await supabase.rpc('fertex_finalizar_compra', {
    p_itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
  })
  if (error) throw error
  return data as string
}
