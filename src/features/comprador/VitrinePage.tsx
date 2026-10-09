import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Eye, Plus, Search, Store } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useAuth } from '@/contexts/AuthContext'
import { carregarVendedores } from '@/lib/vendedores'
import { useToast } from '@/contexts/ToastContext'
import { useAsync } from '@/lib/useAsync'
import { listarProdutosAtivos } from '@/lib/produtos'
import type { Produto } from '@/lib/produtos'
import { formatarMoeda } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { inputClass } from '@/components/ui/Field'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ProdutoFoto } from '@/components/ProdutoFoto'

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function CardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="aspect-square bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  )
}

function ProdutoCard({ produto, vendedorNome, previa }: { produto: Produto; vendedorNome?: string; previa: boolean }) {
  const { adicionar, itens } = useCart()
  const toast = useToast()
  const esgotado = produto.estoque <= 0
  const noCarrinho = itens.find((i) => i.produto_id === produto.id)?.quantidade ?? 0
  const limite = noCarrinho >= produto.estoque

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <Link to={`/loja/${produto.id}`} className="flex flex-1 flex-col focus-visible:outline-2 focus-visible:outline-brand-600">
        <div className="relative">
          <ProdutoFoto url={produto.foto_url} nome={produto.nome} className={`aspect-square w-full ${esgotado ? 'opacity-50 grayscale' : ''}`} />
          {esgotado && (
            <span className="absolute top-2 left-2 rounded-full bg-slate-900/85 px-2.5 py-1 text-xs font-semibold text-white">
              Esgotado
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-3 pb-14">
          <span className="text-xs text-slate-500 dark:text-slate-400">{produto.categoria}</span>
          <h2 className="line-clamp-2 text-sm font-medium">{produto.nome}</h2>
          <span className="mt-1 font-bold">{formatarMoeda(produto.preco)}</span>
          {vendedorNome && <span className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">por {vendedorNome}</span>}
        </div>
      </Link>
      {previa ? (
        <span className="absolute right-3 bottom-3 left-3 rounded-lg bg-slate-100 py-2 text-center text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {esgotado ? 'Esgotado' : `${produto.estoque} em estoque`}
        </span>
      ) : (
      <button
        type="button"
        disabled={esgotado || limite}
        onClick={() => {
          if (adicionar(produto, 1)) toast(`${produto.nome} adicionado ao carrinho.`)
        }}
        className="absolute right-3 bottom-3 left-3 inline-flex items-center justify-center gap-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
        aria-label={esgotado ? `${produto.nome} esgotado` : `Adicionar ${produto.nome} ao carrinho`}
      >
        {esgotado ? (
          'Esgotado'
        ) : limite ? (
          'Limite do estoque'
        ) : (
          <>
            <Plus className="h-4 w-4" aria-hidden /> Adicionar
          </>
        )}
      </button>
      )}
    </li>
  )
}

export default function VitrinePage() {
  const { data, loading, error, reload } = useAsync(listarProdutosAtivos, [])
  const [params, setParams] = useSearchParams()
  const busca = params.get('q') ?? ''
  const categoria = params.get('categoria') ?? ''
  const vendedorId = params.get('vendedor') ?? ''
  const { profile } = useAuth()
  const previa = profile?.perfil === 'vendedor'
  const [vendedores, setVendedores] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    carregarVendedores()
      .then(setVendedores)
      .catch(() => {})
  }, [])

  // Atualiza a URL sem empilhar histórico, para o "voltar" do detalhe manter os filtros
  const atualizar = (k: string, v: string) =>
    setParams(
      (p) => {
        if (v) p.set(k, v)
        else p.delete(k)
        return p
      },
      { replace: true },
    )

  // Link de um vendedor (/loja?vendedor=id) mostra só os produtos dele
  const daLoja = useMemo(() => (data ?? []).filter((p) => !vendedorId || p.vendedor_id === vendedorId), [data, vendedorId])
  const nomeLoja = vendedorId ? vendedores.get(vendedorId) : undefined
  const variosVendedores = new Set((data ?? []).map((p) => p.vendedor_id)).size > 1

  const categorias = useMemo(
    () => [...new Set(daLoja.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [daLoja],
  )

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim())
    return daLoja.filter(
      (p) =>
        (!categoria || p.categoria === categoria) &&
        (!q || normalizar(`${p.nome} ${p.descricao} ${p.categoria}`).includes(q)),
    )
  }, [daLoja, busca, categoria])

  // Disponíveis primeiro, esgotados no fim
  const ordenados = useMemo(() => [...filtrados].sort((a, b) => Number(b.estoque > 0) - Number(a.estoque > 0)), [filtrados])

  const [buscaLocal, setBuscaLocal] = useState(busca)

  return (
    <>
      <PageHeader
        title={vendedorId ? (nomeLoja ? `Loja de ${nomeLoja}` : 'Loja') : 'Loja'}
        subtitle={vendedorId ? 'Escolha os produtos e envie seu pedido pelo WhatsApp.' : 'Encontre os produtos que você precisa.'}
        actions={
          vendedorId && variosVendedores ? (
            <button
              type="button"
              onClick={() => atualizar('vendedor', '')}
              className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Ver todos os vendedores
            </button>
          ) : undefined
        }
      />
      {previa && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-200">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Você está vendo a loja como os clientes veem. Para comprar, use uma conta de comprador.
        </div>
      )}

      <div className="sticky top-14 z-10 -mx-4 mb-4 space-y-3 bg-slate-50/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0 dark:bg-slate-950/95 md:dark:bg-transparent">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={buscaLocal}
            onChange={(e) => {
              setBuscaLocal(e.target.value)
              atualizar('q', e.target.value)
            }}
            placeholder="Buscar produtos"
            aria-label="Buscar produtos"
            className={`${inputClass()} pl-10`}
          />
        </div>
        {categorias.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filtrar por categoria">
            {['', ...categorias].map((c) => {
              const ativo = categoria === c
              return (
                <button
                  key={c || 'todas'}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => atualizar('categoria', c)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    ativo
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {c || 'Todas'}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {loading ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Carregando produtos">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i}>
              <CardSkeleton />
            </li>
          ))}
        </ul>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !daLoja.length ? (
        <EmptyState
          icon={Store}
          title="A loja ainda está vazia"
          description={vendedorId ? 'Este vendedor ainda não tem produtos disponíveis.' : 'Nenhum produto foi cadastrado pelos vendedores até agora.'}
        />
      ) : !ordenados.length ? (
        <EmptyState
          icon={Search}
          title="Nenhum produto encontrado"
          description="Tente outra busca ou categoria."
          action={
            <button
              type="button"
              className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
              onClick={() => {
                setBuscaLocal('')
                setParams(vendedorId ? { vendedor: vendedorId } : {}, { replace: true })
              }}
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ordenados.map((p) => (
            <ProdutoCard
              key={p.id}
              produto={p}
              previa={previa}
              vendedorNome={!vendedorId && variosVendedores ? vendedores.get(p.vendedor_id) : undefined}
            />
          ))}
        </ul>
      )}
    </>
  )
}
