import { supabase } from './supabase'
import { ESTOQUE_BAIXO } from './produtos'
import type { Unidade } from './unidades'

export interface Dashboard {
  inicio: string
  fim: string
  faturamento_total: number
  faturamento_mes: number
  faturamento_periodo: number
  faturamento_periodo_anterior: number
  vendas_periodo: number
  vendas_periodo_anterior: number
  itens_periodo: number
  serie: { dia: string; faturamento: number; vendas: number }[]
  top_produtos: { produto_id: string; nome: string; unidade: Unidade; quantidade: number; faturamento: number }[]
  estoque_baixo: { id: string; nome: string; estoque: number; unidade: Unidade }[]
}

export async function carregarDashboard(dias: number) {
  const { data, error } = await supabase.rpc('fertex_dashboard_vendedor', { p_dias: dias, p_estoque_baixo: ESTOQUE_BAIXO })
  if (error) throw error
  return data as Dashboard
}
