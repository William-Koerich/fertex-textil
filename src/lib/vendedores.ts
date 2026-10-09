import { supabase } from './supabase'

export interface VendedorPublico {
  id: string
  nome: string
}

let cache: Promise<Map<string, string>> | null = null

/** Nomes públicos dos vendedores com produtos ativos (consulta única por sessão de página). */
export function carregarVendedores(): Promise<Map<string, string>> {
  cache ??= (async () => {
    const { data, error } = await supabase.rpc('fertex_vendedores_publicos')
    if (error) {
      cache = null
      throw error
    }
    return new Map((data as VendedorPublico[]).map((v) => [v.id, v.nome]))
  })()
  return cache
}

export const linkDaLoja = (vendedorId: string) => `${window.location.origin}/loja?vendedor=${vendedorId}`
