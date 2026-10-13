import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Qual vendedor (e produto) a página da loja está mostrando, para o botão flutuante do WhatsApp
 * abrir a conversa certa já com a mensagem pronta.
 */
export interface Contato {
  vendedorId?: string | null
  produto?: { id: string; nome: string; preco: string } | null
}

const Ctx = createContext<{ contato: Contato; setContato: (c: Contato) => void } | null>(null)

export function ContatoProvider({ children }: { children: ReactNode }) {
  const [contato, setContato] = useState<Contato>({})
  const value = useMemo(() => ({ contato, setContato }), [contato])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useContatoAtual() {
  return useContext(Ctx)?.contato ?? {}
}

/** Usado pelas páginas da loja: informa o vendedor/produto em exibição (limpa ao sair da página). */
export function useDefinirContato(vendedorId: string | null | undefined, produto?: Contato['produto']) {
  const setContato = useContext(Ctx)?.setContato
  const produtoChave = produto ? `${produto.id}|${produto.nome}|${produto.preco}` : ''
  useEffect(() => {
    if (!setContato) return
    setContato({ vendedorId: vendedorId ?? null, produto: produto ?? null })
    return () => setContato({})
  }, [setContato, vendedorId, produtoChave])
}
