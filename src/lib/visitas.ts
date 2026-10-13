import { supabase } from './supabase'

export type Origem = 'instagram' | 'facebook' | 'whatsapp' | 'direto' | 'outro'

const CHAVE_VISITANTE = 'fertex-visitante'
const CHAVE_ORIGEM = 'fertex-origem'

function lerOuCriarVisitante(): string | null {
  try {
    let id = localStorage.getItem(CHAVE_VISITANTE)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(CHAVE_VISITANTE, id)
    }
    return id
  } catch {
    return null
  }
}

/** De onde a pessoa veio: parâmetro ?origem= dos nossos links, navegador do app ou página anterior. */
export function detectarOrigem(): Origem {
  try {
    const salva = sessionStorage.getItem(CHAVE_ORIGEM) as Origem | null
    const params = new URLSearchParams(location.search)
    const doLink = (params.get('origem') ?? params.get('utm_source') ?? '').toLowerCase()
    let origem: Origem | null = null
    if (['instagram', 'ig'].includes(doLink)) origem = 'instagram'
    else if (['facebook', 'fb'].includes(doLink)) origem = 'facebook'
    else if (['whatsapp', 'wa'].includes(doLink)) origem = 'whatsapp'
    else if (doLink) origem = 'outro'
    else if (/Instagram/i.test(navigator.userAgent)) origem = 'instagram'
    else if (/FBAN|FBAV|FB_IAB/i.test(navigator.userAgent)) origem = 'facebook'
    else if (document.referrer) {
      const host = new URL(document.referrer).hostname
      if (host === location.hostname) origem = salva ?? 'direto'
      else if (/instagram\.com$/.test(host)) origem = 'instagram'
      else if (/(facebook\.com|fb\.me|fb\.com)$/.test(host)) origem = 'facebook'
      else if (/(whatsapp\.com|wa\.me)$/.test(host)) origem = 'whatsapp'
      else origem = 'outro'
    }
    // A origem da chegada vale para a sessão toda (navegação entre páginas da loja)
    const final = origem ?? salva ?? 'direto'
    sessionStorage.setItem(CHAVE_ORIGEM, final)
    return final
  } catch {
    return 'direto'
  }
}

const jaRegistradas = new Set<string>()

/** Registra a visita (o IP e a localização são obtidos no servidor). Falhas são ignoradas. */
export function registrarVisita(alvo: { vendedorId?: string | null; produtoId?: string | null }) {
  const chave = `${alvo.vendedorId ?? ''}|${alvo.produtoId ?? ''}`
  // Navegadores automatizados (robôs que executam JavaScript) não contam
  if (jaRegistradas.has(chave) || navigator.webdriver) return
  jaRegistradas.add(chave)
  let referrer: string | null = null
  try {
    referrer = document.referrer && new URL(document.referrer).hostname !== location.hostname ? document.referrer : null
  } catch {
    /* ignora */
  }
  supabase
    .rpc('fertex_registrar_visita', {
      p_vendedor_id: alvo.vendedorId ?? null,
      p_produto_id: alvo.produtoId ?? null,
      p_origem: detectarOrigem(),
      p_referrer: referrer,
      p_visitante: lerOuCriarVisitante(),
    })
    .then(
      () => {},
      () => {},
    )
}

export interface EstatisticasVisitas {
  inicio: string
  fim: string
  visitas: number
  /** acessos de robôs/datacenters (Facebook, Amazon, Google…) ignorados */
  robos: number
  visitantes: number
  cidades: number
  localizando: number
  serie: { dia: string; visitas: number }[]
  origens: { origem: Origem; visitas: number }[]
  locais: { cidade: string | null; regiao: string | null; pais: string | null; pais_sigla: string | null; visitas: number }[]
  produtos: { produto_id: string; nome: string; visitas: number }[]
  ultimas: {
    criado_em: string
    origem: Origem
    produto: string | null
    cidade: string | null
    regiao: string | null
    pais: string | null
    pais_sigla: string | null
    localizando: boolean
    ip: string | null
  }[]
}

export async function carregarEstatisticas(dias: number) {
  const { data, error } = await supabase.rpc('fertex_estatisticas_visitas', { p_dias: dias })
  if (error) throw error
  return data as EstatisticasVisitas
}

export const ROTULO_ORIGEM: Record<Origem, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  direto: 'Link direto',
  outro: 'Outros sites',
}

/** "Curitiba/PR", "Lisboa, Portugal" ou "Localizando…" */
export function formatarLocal(l: { cidade: string | null; regiao: string | null; pais: string | null; pais_sigla: string | null }) {
  if (!l.cidade && !l.pais) return null
  if (l.pais_sigla === 'BR') return [l.cidade, l.regiao].filter(Boolean).join('/')
  return [l.cidade, l.pais].filter(Boolean).join(', ')
}
