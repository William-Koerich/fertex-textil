/**
 * Recuperação quando um trecho do app (tela carregada sob demanda) não baixa — típico logo depois de
 * uma nova publicação: o navegador pode ter guardado uma resposta de erro (404) para o arquivo.
 * Força o navegador a buscar o arquivo de novo (ignorando o que estava guardado) e recarrega a página
 * uma única vez por arquivo (sem loop).
 */
const PADRAO = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i

export function ehFalhaDeVersao(erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : String((erro as { message?: string })?.message ?? erro ?? '')
  return PADRAO.test(msg)
}

export function recuperarVersao(erro: unknown): boolean {
  if (!ehFalhaDeVersao(erro)) return false
  const msg = erro instanceof Error ? erro.message : String(erro)
  const url = msg.match(/https?:\/\/\S+?\.(?:js|css)/)?.[0] ?? ''
  const chave = `fertex-recuperado:${url || 'chunk'}`
  try {
    if (sessionStorage.getItem(chave)) return false // já tentou nesta sessão: mostra o erro normal
    sessionStorage.setItem(chave, '1')
  } catch {
    return false
  }
  const limpar: Promise<unknown>[] = []
  if (url) limpar.push(fetch(url, { cache: 'reload' }).catch(() => {}))
  if ('serviceWorker' in navigator)
    limpar.push(navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.update().catch(() => {})))))
  Promise.all(limpar).finally(() => window.location.reload())
  return true
}
