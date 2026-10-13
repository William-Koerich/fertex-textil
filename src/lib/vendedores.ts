import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface VendedorPublico {
  id: string
  nome: string
  /** WhatsApp público do vendedor (só dígitos, com DDI) */
  whatsapp: string | null
}

let cache: Promise<VendedorPublico[]> | null = null

/** Vendedores com produtos ativos: nome e WhatsApp (consulta única por sessão de página). */
export function carregarVendedoresInfo(): Promise<VendedorPublico[]> {
  cache ??= (async () => {
    const { data, error } = await supabase.rpc('fertex_vendedores_publicos')
    if (error) {
      cache = null
      throw error
    }
    return data as VendedorPublico[]
  })()
  return cache
}

/** Mapa id → nome (usado para "Vendido por …") */
export async function carregarVendedores(): Promise<Map<string, string>> {
  return new Map((await carregarVendedoresInfo()).map((v) => [v.id, v.nome]))
}

/** Lista de vendedores públicos como estado React (vazia enquanto carrega ou se falhar) */
export function useVendedoresPublicos() {
  const [lista, setLista] = useState<VendedorPublico[]>([])
  useEffect(() => {
    carregarVendedoresInfo()
      .then(setLista)
      .catch(() => {})
  }, [])
  return lista
}

export const linkDaLoja = (vendedorId: string) => `${window.location.origin}/loja?vendedor=${vendedorId}`
