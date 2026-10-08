import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Produto } from '@db/schema'

/** Item do carrinho: guarda uma cópia dos dados do produto para exibição rápida (atualizada ao abrir o carrinho). */
export interface ItemCarrinho {
  produto_id: string
  quantidade: number
  nome: string
  preco: number
  foto_url: string | null
  estoque: number
}

interface CartValue {
  itens: ItemCarrinho[]
  totalItens: number
  subtotal: number
  /** Adiciona respeitando o estoque. Retorna a quantidade efetivamente adicionada. */
  adicionar: (p: Produto, quantidade?: number) => number
  alterarQuantidade: (produtoId: string, quantidade: number) => void
  remover: (produtoId: string) => void
  limpar: () => void
  /** Atualiza nome/preço/estoque com dados novos do servidor e remove produtos que não existem mais */
  sincronizar: (produtos: Produto[]) => void
}

const CartContext = createContext<CartValue | null>(null)

function carregar(chave: string): ItemCarrinho[] {
  try {
    const raw = localStorage.getItem(chave)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** O carrinho é salvo no aparelho, separado por usuário. */
export function CartProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const chave = `fertex-carrinho:${userId}`
  const [itens, setItens] = useState<ItemCarrinho[]>(() => carregar(chave))

  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify(itens))
    } catch {
      /* armazenamento indisponível: carrinho fica só em memória */
    }
  }, [chave, itens])

  // Mantém abas diferentes sincronizadas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === chave && setItens(carregar(chave))
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [chave])

  const adicionar = useCallback((p: Produto, quantidade = 1) => {
    const atual = itens.find((i) => i.produto_id === p.id)?.quantidade ?? 0
    const nova = Math.min(p.estoque, atual + quantidade)
    const adicionada = Math.max(0, nova - atual)
    if (nova <= 0) return 0
    setItens((lista) => {
      const item: ItemCarrinho = {
        produto_id: p.id,
        quantidade: nova,
        nome: p.nome,
        preco: p.preco,
        foto_url: p.foto_url,
        estoque: p.estoque,
      }
      return atual ? lista.map((i) => (i.produto_id === p.id ? item : i)) : [...lista, item]
    })
    return adicionada
  }, [itens])

  const alterarQuantidade = useCallback((produtoId: string, quantidade: number) => {
    setItens((lista) =>
      lista.map((i) =>
        i.produto_id === produtoId ? { ...i, quantidade: Math.max(1, Math.min(i.estoque, Math.floor(quantidade))) } : i,
      ),
    )
  }, [])

  const remover = useCallback((produtoId: string) => setItens((l) => l.filter((i) => i.produto_id !== produtoId)), [])
  const limpar = useCallback(() => setItens([]), [])

  const sincronizar = useCallback((produtos: Produto[]) => {
    const porId = new Map(produtos.map((p) => [p.id, p]))
    setItens((lista) =>
      lista.flatMap((i) => {
        const p = porId.get(i.produto_id)
        if (!p) return [{ ...i, estoque: 0 }]
        return [{ ...i, nome: p.nome, preco: p.preco, foto_url: p.foto_url, estoque: p.ativo ? p.estoque : 0 }]
      }),
    )
  }, [])

  const value = useMemo<CartValue>(() => {
    const totalItens = itens.reduce((s, i) => s + i.quantidade, 0)
    const subtotal = itens.reduce((s, i) => s + i.quantidade * i.preco, 0)
    return { itens, totalItens, subtotal, adicionar, alterarQuantidade, remover, limpar, sincronizar }
  }, [itens, adicionar, alterarQuantidade, remover, limpar, sincronizar])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart deve ser usado dentro de <CartProvider>')
  return ctx
}
