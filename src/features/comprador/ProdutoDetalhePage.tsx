import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useAuth } from '@/contexts/AuthContext'
import { carregarVendedores } from '@/lib/vendedores'
import { useToast } from '@/contexts/ToastContext'
import { useAsync } from '@/lib/useAsync'
import { buscarProduto, ESTOQUE_BAIXO } from '@/lib/produtos'
import { formatarMoeda } from '@/lib/format'
import { Button, buttonClass } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { ProdutoFoto } from '@/components/ProdutoFoto'
import { formatarQuantidade, siglaUnidade, UNIDADES } from '@/lib/unidades'

export default function ProdutoDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: produto, loading, error, reload } = useAsync(() => buscarProduto(id!), [id])
  const { adicionar, totalDoProduto } = useCart()
  const [cor, setCor] = useState<string | null>(null)
  const [erroCor, setErroCor] = useState(false)
  const toast = useToast()
  const [qtd, setQtd] = useState(1)
  const { profile } = useAuth()
  const previa = profile?.perfil === 'vendedor'
  const [vendedores, setVendedores] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    carregarVendedores()
      .then(setVendedores)
      .catch(() => {})
  }, [])

  const voltar = (
    <button type="button" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/loja'))} className={buttonClass('ghost', '-ml-3 mb-3')}>
      <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
    </button>
  )

  if (loading) return <LoadingState label="Carregando produto…" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!produto || !produto.ativo)
    return (
      <>
        {voltar}
        <EmptyState
          title="Produto indisponível"
          description="Este produto não existe mais ou foi retirado da loja."
          action={
            <Link to="/loja" className={buttonClass('primary')}>
              Ver a loja
            </Link>
          }
        />
      </>
    )

  // Estoque e mínimo são do produto: soma todas as cores já no carrinho
  const noCarrinho = totalDoProduto(produto.id)
  const cores = produto.cores ?? []
  const disponivel = Math.max(0, produto.estoque - noCarrinho)
  const esgotado = produto.estoque <= 0
  const minimo = produto.quantidade_minima ?? 1
  // Abaixo do mínimo não há como pedir; já com o produto no carrinho, dá para somar de 1 em 1
  const semEstoqueParaMinimo = !esgotado && produto.estoque < minimo
  const minAdicionar = noCarrinho > 0 ? 1 : minimo
  const qtdEfetiva = Math.max(minAdicionar, Math.min(qtd, disponivel))

  return (
    <>
      {voltar}
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <ProdutoFoto url={produto.foto_url} nome={produto.nome} className="aspect-square w-full rounded-2xl" />
        <div className="flex flex-col">
          <span className="text-sm text-slate-500 dark:text-slate-400">{produto.categoria}</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{produto.nome}</h1>
          {vendedores.get(produto.vendedor_id) && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Vendido por{' '}
              <Link to={`/loja?vendedor=${produto.vendedor_id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                {vendedores.get(produto.vendedor_id)}
              </Link>
            </p>
          )}
          <p className="mt-3 text-3xl font-bold text-brand-700 dark:text-brand-300">
            {formatarMoeda(produto.preco)}
            <span className="text-lg font-medium text-slate-500 dark:text-slate-400"> / {siglaUnidade(produto.unidade)}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Preço por {UNIDADES.find((u) => u.valor === produto.unidade)?.label.toLowerCase()}</p>
          {minimo > 1 && (
            <p className="mt-3 w-fit rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
              Pedido mínimo: {formatarQuantidade(minimo, produto.unidade)}
            </p>
          )}

          <p className="mt-2 text-sm">
            {esgotado ? (
              <span className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                Esgotado
              </span>
            ) : produto.estoque <= ESTOQUE_BAIXO ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">Restam só {formatarQuantidade(produto.estoque, produto.unidade)}!</span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">{formatarQuantidade(produto.estoque, produto.unidade)} disponíveis</span>
            )}
          </p>

          {produto.descricao && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold">Descrição</h2>
              <p className="mt-1 whitespace-pre-line text-slate-600 dark:text-slate-300">{produto.descricao}</p>
            </div>
          )}

          <div className="mt-8 space-y-3">
            {noCarrinho > 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Você já tem {formatarQuantidade(noCarrinho, produto.unidade)} no{' '}
                <Link to="/carrinho" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
                  carrinho
                </Link>
                .
              </p>
            )}
            {previa ? (
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Prévia: é assim que os clientes veem este produto.
              </p>
            ) : esgotado ? (
              <Button disabled className="w-full">
                Esgotado
              </Button>
            ) : semEstoqueParaMinimo ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                No momento o estoque ({formatarQuantidade(produto.estoque, produto.unidade)}) está abaixo do pedido mínimo. Fale com o vendedor.
              </p>
            ) : disponivel === 0 ? (
              <Link to="/carrinho" className={buttonClass('secondary', 'w-full')}>
                Todo o estoque já está no seu carrinho
              </Link>
            ) : (
              <div className="space-y-4">
                {cores.length > 0 && (
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold">
                      Cor{cor && <span className="font-normal text-slate-500 dark:text-slate-400">: {cor}</span>}
                    </legend>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
                      {cores.map((c) => (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={cor === c}
                          onClick={() => {
                            setCor(c)
                            setErroCor(false)
                          }}
                          className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                            cor === c
                              ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200'
                              : 'border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    {erroCor && <p className="mt-2 text-sm text-red-600 dark:text-red-400">Escolha a cor antes de adicionar.</p>}
                  </fieldset>
                )}
              <div className="flex gap-3">
                <div className="flex items-center gap-2">
                  <QuantityStepper value={qtdEfetiva} min={minAdicionar} max={disponivel} onChange={setQtd} label="Quantidade" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">{siglaUnidade(produto.unidade)}</span>
                </div>
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (cores.length && !cor) return setErroCor(true)
                    const n = adicionar(produto, qtdEfetiva, cor)
                    if (n) {
                      toast(`${formatarQuantidade(n, produto.unidade)} de ${produto.nome}${cor ? ` (${cor})` : ''} adicionado ao carrinho.`)
                      setQtd(1)
                    }
                  }}
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden /> Adicionar ao carrinho
                </Button>
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
