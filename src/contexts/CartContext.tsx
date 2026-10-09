import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Produto } from '@db/schema'

/**
 * Item do carrinho: um por produto + cor. Guarda uma cópia dos dados do produto para exibição rápida
 * (atualizada ao abrir o carrinho). Estoque e pedido mínimo são do PRODUTO (somam todas as cores).
 */
export interface ItemCarrinho {
  produto_id: string
  /** cor escolhida (null/ausente em produtos sem variação de cor) */
  cor?: string | null
  quantidade: number
  nome: string
  preco: number
  foto_url: string | null
  estoque: number
  vendedor_id?: string
  unidade?: Produto['unidade']
  /** quantidade mínima por pedido (null/ausente = sem mínimo) */
  quantidade_minima?: number | null
  /** cores disponíveis no produto (para validar a cor escolhida) */
  cores?: string[]
}

/** Identifica a linha do carrinho (produto + cor). */
export const chaveItem = (i: Pick<ItemCarrinho, 'produto_id' | 'cor'>) => `${i.produto_id}|${i.cor ?? ''}`

interface CartValue {
  itens: ItemCarrinho[]
  /** quantidade de linhas no carrinho (as quantidades têm unidades diferentes, não dá para somar) */
  totalItens: number
  subtotal: number
  /** Total do produto no carrinho, somando todas as cores */
  totalDoProduto: (produtoId: string) => number
  /** Adiciona respeitando estoque e pedido mínimo do produto. Retorna a quantidade efetivamente adicionada. */
  adicionar: (p: Produto, quantidade?: number, cor?: string | null) => number
  alterarQuantidade: (chave: string, quantidade: number) => void
  remover: (chave: string) => void
  limpar: () => void
  /** Atualiza nome/preço/estoque/cores com dados novos do servidor */
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
  const porChave = new Map(doUsuario.map((i) => [chaveItem(i), { ...i }]))
  for (const a of anonimo) {
    const atual = porChave.get(chaveItem(a))
    if (atual) atual.quantidade += a.quantidade
    else porChave.set(chaveItem(a), a)
  }
  // O carrinho anônimo é apagado num efeito (o inicializador pode rodar 2x no StrictMode)
  return [...porChave.values()]
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

  const totalDoProduto = useCallback(
    (produtoId: string) => itens.filter((i) => i.produto_id === produtoId).reduce((s, i) => s + i.quantidade, 0),
    [itens],
  )

  const adicionar = useCallback(
    (p: Produto, quantidade = 1, cor: string | null = null) => {
      const corFinal = p.cores?.length ? cor : null
      if (p.cores?.length && !corFinal) return 0
      const minimo = p.quantidade_minima ?? 1
      if (p.estoque < minimo) return 0
      const totalProduto = itens.filter((i) => i.produto_id === p.id).reduce((s, i) => s + i.quantidade, 0)
      // Primeiro item do produto já entra com o mínimo; depois soma livremente até o estoque
      const desejado = totalProduto === 0 ? Math.max(minimo, quantidade) : quantidade
      const adicionada = Math.max(0, Math.min(desejado, p.estoque - totalProduto))
      if (adicionada <= 0) return 0
      const k = chaveItem({ produto_id: p.id, cor: corFinal })
      setItens((lista) => {
        const atual = lista.find((i) => chaveItem(i) === k)
        const item: ItemCarrinho = {
          produto_id: p.id,
          cor: corFinal,
          quantidade: (atual?.quantidade ?? 0) + adicionada,
          nome: p.nome,
          preco: p.preco,
          foto_url: p.foto_url,
          estoque: p.estoque,
          vendedor_id: p.vendedor_id,
          unidade: p.unidade,
          quantidade_minima: p.quantidade_minima,
          cores: p.cores ?? [],
        }
        return atual ? lista.map((i) => (chaveItem(i) === k ? item : i)) : [...lista, item]
      })
      return adicionada
    },
    [itens],
  )

  const alterarQuantidade = useCallback((k: string, quantidade: number) => {
    setItens((lista) => {
      const alvo = lista.find((i) => chaveItem(i) === k)
      if (!alvo) return lista
      // Limites consideram as outras cores do mesmo produto
      const outras = lista.filter((i) => i.produto_id === alvo.produto_id && chaveItem(i) !== k).reduce((s, i) => s + i.quantidade, 0)
      const max = Math.max(1, alvo.estoque - outras)
      const min = Math.max(1, (alvo.quantidade_minima ?? 1) - outras)
      const q = Math.max(min, Math.min(max, Math.floor(quantidade)))
      return lista.map((i) => (chaveItem(i) === k ? { ...i, quantidade: q } : i))
    })
  }, [])

  const remover = useCallback((k: string) => setItens((l) => l.filter((i) => chaveItem(i) !== k)), [])
  const limpar = useCallback(() => setItens([]), [])

  const sincronizar = useCallback((produtos: Produto[]) => {
    const porId = new Map(produtos.map((p) => [p.id, p]))
    setItens((lista) =>
      lista.map((i) => {
        const p = porId.get(i.produto_id)
        if (!p) return { ...i, estoque: 0 }
        return {
          ...i,
          nome: p.nome,
          preco: p.preco,
          foto_url: p.foto_url,
          estoque: p.ativo && !p.excluido_em ? p.estoque : 0,
          vendedor_id: p.vendedor_id,
          unidade: p.unidade,
          quantidade_minima: p.quantidade_minima,
          cores: p.cores ?? [],
          // Produto deixou de ter cores: a cor escolhida não vale mais
          cor: p.cores?.length ? i.cor : null,
        }
      }),
    )
  }, [])

  const value = useMemo<CartValue>(() => {
    const totalItens = itens.length
    const subtotal = itens.reduce((s, i) => s + i.quantidade * i.preco, 0)
    return { itens, totalItens, subtotal, totalDoProduto, adicionar, alterarQuantidade, remover, limpar, sincronizar }
  }, [itens, totalDoProduto, adicionar, alterarQuantidade, remover, limpar, sincronizar])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart deve ser usado dentro de <CartProvider>')
  return ctx
}
