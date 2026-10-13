import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { aguardarVisitas, lerOuCriarVisitante } from './visitas'

/**
 * Localização exata (GPS) do visitante, só com autorização.
 * Fluxo: aviso explicando o motivo → pedido oficial do navegador → posição enviada ao servidor,
 * que guarda arredondada (~100 m) e descobre bairro/cidade. Quem recusa não é perguntado de novo por 30 dias.
 */

const CHAVE = 'fertex-localizacao'
const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000
let enviadaNestaSessao = false

type Escolha = { estado: 'aceito' | 'recusado'; em: number }

function lerEscolha(): Escolha | null {
  try {
    const v = localStorage.getItem(CHAVE)
    return v ? (JSON.parse(v) as Escolha) : null
  } catch {
    return null
  }
}

function salvarEscolha(estado: Escolha['estado']) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ estado, em: Date.now() }))
  } catch {
    /* ignora */
  }
}

async function permissaoAtual(): Promise<PermissionState | 'indisponivel'> {
  if (!('geolocation' in navigator)) return 'indisponivel'
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state
  } catch {
    return 'prompt' // Safari antigo: sem Permissions API
  }
}

function lerPosicao(): Promise<GeolocationPosition> {
  return new Promise((ok, erro) =>
    navigator.geolocation.getCurrentPosition(ok, erro, { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60 * 1000 }),
  )
}

async function enviar(pos: GeolocationPosition) {
  await aguardarVisitas()
  await supabase.rpc('fertex_registrar_localizacao', {
    p_visitante: lerOuCriarVisitante(),
    p_lat: pos.coords.latitude,
    p_lon: pos.coords.longitude,
    p_precisao: pos.coords.accuracy,
  })
  enviadaNestaSessao = true
}

/** Usado nas páginas da loja. `ativo` = false para vendedores (não contam nas estatísticas). */
export function useLocalizacaoVisitante(ativo: boolean) {
  const [mostrarAviso, setMostrarAviso] = useState(false)

  useEffect(() => {
    if (!ativo || enviadaNestaSessao || navigator.webdriver) return
    let cancelado = false
    ;(async () => {
      const estado = await permissaoAtual()
      if (cancelado || estado === 'indisponivel' || estado === 'denied') return
      if (estado === 'granted') {
        // Já autorizou antes: lê a posição sem perguntar de novo
        lerPosicao().then(enviar, () => {})
        return
      }
      const escolha = lerEscolha()
      if (escolha?.estado === 'recusado' && Date.now() - escolha.em < TRINTA_DIAS) return
      // Pequena espera para a página aparecer antes do aviso
      setTimeout(() => !cancelado && setMostrarAviso(true), 1500)
    })()
    return () => {
      cancelado = true
    }
  }, [ativo])

  const permitir = useCallback(() => {
    setMostrarAviso(false)
    lerPosicao().then(
      (pos) => {
        salvarEscolha('aceito')
        enviar(pos).catch(() => {})
      },
      () => salvarEscolha('recusado'),
    )
  }, [])

  const recusar = useCallback(() => {
    setMostrarAviso(false)
    salvarEscolha('recusado')
  }, [])

  return { mostrarAviso, permitir, recusar }
}
