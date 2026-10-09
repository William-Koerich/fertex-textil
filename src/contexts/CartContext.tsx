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
  vendedor_id?: string
  unidade?: Produto['unidade']
  /** quantidade mínima por pedido (null/ausente = sem mínimo) */
  quantidade_minima?: number | null
}

interface CartValue {
  itens: ItemCarrinho[]
  /** quantidade de produtos diferentes no carrinho (as quantidades têm unidades diferentes) */
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

const CHAVE_ANONIMO = 'fertex-carrinho:anon'

/** Junta o carrinho montado sem login ao carrinho do usuário (somando quantidades). */
function mesclarComAnonimo(chave: string): ItemCarrinho[] {
  const doUsuario = carregar(chave)
  if (chave === CHAVE_ANONIMO) return doUsuario
  const anonimo = carregar(CHAVE_ANONIMO)
  if (!anonimo.length) return doUsuario
  const porId = new Map(doUsuario.map((i) => [i.produto_id, { ...i }]))
  for (const a of anonimo) {
    const atual = porId.get(a.produto_id)
    if (atual) atual.quantidade = Math.min(Math.max(atual.estoque, a.estoque), atual.quantidade + a.quantidade)
    else porId.set(a.produto_id, a)
  }
  // O carrinho anônimo é apagado num efeito (o inicializador pode rodar 2x no StrictMode)
  return [...porId.values()]
}

/**
 * O carrinho é salvo no aparelho, separado por usuário (userId null = visitante sem login).
 * Ao entrar na conta, o que foi adicionado sem login é levado para o carrinho do usuário.
 */
export function CartProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const chave = userId ? `fertex-carrinho:${userId}` : CHAVE_ANONIMO
  const [itens, setItens] = useState<ItemCarrinho[]>(() => mesclarComAnonimo(chave))

  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify(itens))
      if (chave !== CHAVE_ANONIMO) localStorage.removeItem(CHAVE_ANONIMO)
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
    const minimo = p.quantidade_minima ?? 1
    // Respeita a quantidade mínima: o primeiro "adicionar" já coloca o mínimo
    if (p.estoque < minimo) return 0
    const nova = Math.min(p.estoque, Math.max(minimo, atual + quantidade))
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
        vendedor_id: p.vendedor_id,
        unidade: p.unidade,
        quantidade_minima: p.quantidade_minima,
      }
      return atual ? lista.map((i) => (i.produto_id === p.id ? item : i)) : [...lista, item]
    })
    return adicionada
  }, [itens])

  const alterarQuantidade = useCallback((produtoId: string, quantidade: number) => {
    setItens((lista) =>
      lista.map((i) =>
        i.produto_id === produtoId
          ? { ...i, quantidade: Math.max(i.quantidade_minima ?? 1, Math.min(i.estoque, Math.floor(quantidade))) }
          : i,
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
        return [{ ...i, nome: p.nome, preco: p.preco, foto_url: p.foto_url, estoque: p.ativo && !p.excluido_em ? p.estoque : 0, vendedor_id: p.vendedor_id, unidade: p.unidade, quantidade_minima: p.quantidade_minima }]
      }),
    )
  }, [])

  const value = useMemo<CartValue>(() => {
    const totalItens = itens.length
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
