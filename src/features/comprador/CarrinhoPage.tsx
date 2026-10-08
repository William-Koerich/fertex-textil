import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ShoppingCart, Trash } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { mensagemErro } from '@/lib/errors'
import { finalizarCompra } from '@/lib/pedidos'
import type { Produto } from '@/lib/produtos'
import { formatarMoeda, formatarNumero } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, buttonClass, IconButton } from '@/components/ui/Button'
import { Alert, EmptyState } from '@/components/ui/States'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { ProdutoFoto } from '@/components/ProdutoFoto'
import { Spinner } from '@/components/ui/Spinner'

export default function CarrinhoPage() {
  const { itens, subtotal, totalItens, alterarQuantidade, remover, limpar, sincronizar } = useCart()
  const toast = useToast()
  const navigate = useNavigate()
  const [atualizando, setAtualizando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const ids = itens.map((i) => i.produto_id).sort().join(',')

  async function atualizarDoServidor() {
    if (!ids) return
    setAtualizando(true)
    const { data, error } = await supabase.from('fertex_produtos').select('*').in('id', ids.split(','))
    if (!error && data) sincronizar(data as Produto[])
    setAtualizando(false)
  }

  // Ao abrir o carrinho, confere preço e estoque atuais
  useEffect(() => {
    atualizarDoServidor()
  }, [ids])

  const problemas = itens.filter((i) => i.estoque <= 0 || i.quantidade > i.estoque)

  async function concluir() {
    setEnviando(true)
    setErro(null)
    try {
      const pedidoId = await finalizarCompra(itens)
      limpar()
      toast('Compra concluída! Obrigado pelo pedido.')
      navigate('/pedidos', { state: { novoPedido: pedidoId } })
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível finalizar a compra. Tente novamente.'))
      setConfirmando(false)
      const hint = (e as { hint?: string }).hint
      if (hint === 'estoque' || hint === 'indisponivel') await atualizarDoServidor()
    } finally {
      setEnviando(false)
    }
  }

  if (!itens.length)
    return (
      <>
        <PageHeader title="Carrinho" />
        <EmptyState
          icon={ShoppingCart}
          title="Seu carrinho está vazio"
          description="Explore a loja e adicione produtos para comprar."
          action={
            <Link to="/loja" className={buttonClass('primary')}>
              Ir para a loja
            </Link>
          }
        />
      </>
    )

  return (
    <>
      <PageHeader
        title="Carrinho"
        subtitle={`${formatarNumero(totalItens)} ${totalItens === 1 ? 'item' : 'itens'}`}
        actions={atualizando ? <Spinner className="h-5 w-5 text-slate-400" /> : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <ul className="space-y-3">
          {itens.map((i) => {
            const indisponivel = i.estoque <= 0
            const excede = !indisponivel && i.quantidade > i.estoque
            return (
              <li
                key={i.produto_id}
                className={`flex gap-3 rounded-xl border bg-white p-3 dark:bg-slate-900 ${
                  indisponivel || excede ? 'border-amber-300 dark:border-amber-800' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <Link to={`/loja/${i.produto_id}`} className="shrink-0">
                  <ProdutoFoto url={i.foto_url} nome={i.nome} className={`h-20 w-20 rounded-lg ${indisponivel ? 'opacity-50 grayscale' : ''}`} />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/loja/${i.produto_id}`} className="line-clamp-2 font-medium hover:underline">
                        {i.nome}
                      </Link>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{formatarMoeda(i.preco)} cada</p>
                    </div>
                    <IconButton
                      onClick={() => remover(i.produto_id)}
                      aria-label={`Remover ${i.nome}`}
                      title="Remover"
                      className="-mt-1 -mr-1 shrink-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <Trash className="h-5 w-5" />
                    </IconButton>
                  </div>
                  {indisponivel ? (
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Esgotado ou indisponível. Remova do carrinho.</p>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <QuantityStepper
                        size="sm"
                        value={i.quantidade}
                        max={Math.max(i.estoque, i.quantidade)}
                        onChange={(v) => alterarQuantidade(i.produto_id, v)}
                        label={`Quantidade de ${i.nome}`}
                      />
                      <span className="font-semibold">{formatarMoeda(i.preco * i.quantidade)}</span>
                    </div>
                  )}
                  {excede && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Só restam {formatarNumero(i.estoque)}.{' '}
                      <button type="button" className="font-semibold underline" onClick={() => alterarQuantidade(i.produto_id, i.estoque)}>
                        Ajustar
                      </button>
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-8 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Resumo</h2>
          {erro && <Alert>{erro}</Alert>}
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Subtotal ({formatarNumero(totalItens)} itens)</dt>
              <dd>{formatarMoeda(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Frete</dt>
              <dd className="text-emerald-600 dark:text-emerald-400">Grátis</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold dark:border-slate-800">
              <dt>Total</dt>
              <dd>{formatarMoeda(subtotal)}</dd>
            </div>
          </dl>
          {problemas.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">Ajuste os itens destacados para continuar.</p>
          )}
          <Button className="w-full" disabled={problemas.length > 0 || atualizando} onClick={() => setConfirmando(true)}>
            Finalizar compra
          </Button>
          <Link to="/loja" className="block text-center text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
            Continuar comprando
          </Link>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmando}
        title="Confirmar compra?"
        confirmLabel="Confirmar compra"
        loading={enviando}
        onConfirm={concluir}
        onCancel={() => setConfirmando(false)}
      >
        <p>
          {formatarNumero(totalItens)} {totalItens === 1 ? 'item' : 'itens'} no total de <strong>{formatarMoeda(subtotal)}</strong>.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Ambiente de demonstração: nenhum pagamento será cobrado.</p>
      </ConfirmDialog>
    </>
  )
}
