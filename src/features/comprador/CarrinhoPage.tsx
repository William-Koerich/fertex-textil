import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CircleCheck, LogIn, MessageCircle, ShoppingCart, Trash } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import type { ItemCarrinho } from '@/contexts/CartContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { mensagemErro } from '@/lib/errors'
import { enviarPedidoWhatsapp } from '@/lib/pedidos'
import type { PedidoEnviado } from '@/lib/pedidos'
import type { Produto } from '@/lib/produtos'
import { carregarVendedores } from '@/lib/vendedores'
import { codigoPedido, linkWhatsapp, mensagemPedido } from '@/lib/whatsapp'
import { formatarMoeda, formatarNumero } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { buttonClass, IconButton } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { Alert, EmptyState } from '@/components/ui/States'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { ProdutoFoto } from '@/components/ProdutoFoto'
import { Spinner } from '@/components/ui/Spinner'
import { formatarPrecoPor, formatarQuantidade, siglaUnidade } from '@/lib/unidades'

const botaoWhatsapp =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f8a4c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#18733f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f8a4c] disabled:cursor-not-allowed disabled:opacity-60'

/** Tela exibida depois que o pedido foi registrado: um botão de WhatsApp por vendedor. */
function PedidoEnviadoView({ pedidos, observacao, comprador }: { pedidos: PedidoEnviado[]; observacao: string; comprador: string }) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CircleCheck className="h-14 w-14 text-emerald-500" aria-hidden />
        <h1 className="text-2xl font-bold">Pedido registrado!</h1>
        <p className="text-slate-600 dark:text-slate-300">
          Agora envie {pedidos.length > 1 ? 'as mensagens' : 'a mensagem'} pelo WhatsApp para combinar pagamento e entrega
          {pedidos.length > 1 ? ' com cada vendedor' : ''}.
        </p>
      </div>
      <ul className="space-y-3">
        {pedidos.map((p) => (
          <li key={p.pedido_id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{p.vendedor_nome}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pedido #{codigoPedido(p.pedido_id)}</p>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {formatarNumero(p.itens.reduce((s, i) => s + i.quantidade, 0))} itens · {formatarMoeda(p.total)}
            </p>
            <a
              href={linkWhatsapp(p.whatsapp, mensagemPedido({ ...p, observacao }, comprador))}
              target="_blank"
              rel="noopener noreferrer"
              className={`${botaoWhatsapp} mt-3 w-full`}
            >
              <MessageCircle className="h-5 w-5" aria-hidden /> Enviar no WhatsApp
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
        O vendedor confirma a venda depois de combinar com você. Acompanhe em{' '}
        <Link to="/pedidos" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Meus pedidos
        </Link>
        .
      </p>
    </div>
  )
}

export default function CarrinhoPage() {
  const { itens, subtotal, totalItens, alterarQuantidade, remover, limpar, sincronizar } = useCart()
  const { session, profile } = useAuth()
  const [atualizando, setAtualizando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [observacao, setObservacao] = useState('')
  const [enviados, setEnviados] = useState<PedidoEnviado[] | null>(null)
  const [vendedores, setVendedores] = useState<Map<string, string>>(new Map())

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

  useEffect(() => {
    carregarVendedores()
      .then(setVendedores)
      .catch(() => {})
  }, [])

  // Agrupa por vendedor: cada vendedor recebe o próprio pedido no WhatsApp
  const grupos = useMemo(() => {
    const m = new Map<string, ItemCarrinho[]>()
    for (const i of itens) {
      const k = i.vendedor_id ?? ''
      m.set(k, [...(m.get(k) ?? []), i])
    }
    return [...m.entries()]
  }, [itens])

  const problemas = itens.filter((i) => i.estoque <= 0 || i.quantidade > i.estoque)
  const ehComprador = profile?.perfil === 'comprador'

  async function enviar() {
    setEnviando(true)
    setErro(null)
    try {
      const pedidos = await enviarPedidoWhatsapp(itens, observacao)
      setEnviados(pedidos)
      limpar()
      window.scrollTo({ top: 0 })
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível enviar o pedido. Tente novamente.'))
      const hint = (e as { hint?: string }).hint
      if (hint === 'estoque' || hint === 'indisponivel') await atualizarDoServidor()
    } finally {
      setEnviando(false)
    }
  }

  if (enviados) return <PedidoEnviadoView pedidos={enviados} observacao={observacao.trim()} comprador={profile?.nome ?? ''} />

  if (!itens.length)
    return (
      <>
        <PageHeader title="Carrinho" />
        <EmptyState
          icon={ShoppingCart}
          title="Seu carrinho está vazio"
          description="Explore a loja e adicione produtos para fazer seu pedido."
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
        <div className="space-y-5">
          {grupos.map(([vendedorId, lista]) => (
            <section key={vendedorId || 'sem-vendedor'} aria-label={vendedores.get(vendedorId) ?? 'Produtos'}>
              {grupos.length > 1 && vendedores.get(vendedorId) && (
                <h2 className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Vendido por {vendedores.get(vendedorId)}</h2>
              )}
              <ul className="space-y-3">
                {lista.map((i) => {
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
                            <p className="text-sm text-slate-500 dark:text-slate-400">{formatarPrecoPor(i.preco, i.unidade)}</p>
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
                            <div className="flex items-center gap-2">
                              <QuantityStepper
                                size="sm"
                                value={i.quantidade}
                                max={Math.max(i.estoque, i.quantidade)}
                                onChange={(v) => alterarQuantidade(i.produto_id, v)}
                                label={`Quantidade de ${i.nome}`}
                              />
                              <span className="text-sm text-slate-500 dark:text-slate-400">{siglaUnidade(i.unidade)}</span>
                            </div>
                            <span className="font-semibold">{formatarMoeda(i.preco * i.quantidade)}</span>
                          </div>
                        )}
                        {excede && (
                          <p className="text-sm text-amber-700 dark:text-amber-400">
                            Só restam {formatarQuantidade(i.estoque, i.unidade)}.{' '}
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
            </section>
          ))}
        </div>

        <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-8 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Resumo</h2>
          {erro && <Alert>{erro}</Alert>}
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-200 pb-2 text-base font-bold dark:border-slate-800">
              <dt>Total</dt>
              <dd>{formatarMoeda(subtotal)}</dd>
            </div>
          </dl>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            O pedido é enviado pelo WhatsApp do vendedor, onde vocês combinam pagamento e entrega.
          </p>

          {!session ? (
            <>
              <Link to="/entrar" state={{ from: '/carrinho' }} className={buttonClass('primary', 'w-full')}>
                <LogIn className="h-4 w-4" aria-hidden /> Entrar para enviar o pedido
              </Link>
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                Não tem conta?{' '}
                <Link to="/cadastro" state={{ from: '/carrinho' }} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
                  Criar conta
                </Link>
              </p>
            </>
          ) : !ehComprador ? (
            <Alert kind="info">Você está como vendedor. Para fazer pedidos, entre com uma conta de comprador.</Alert>
          ) : (
            <>
              <Textarea
                label="Observação (opcional)"
                rows={2}
                maxLength={500}
                placeholder="Ex.: cor, medida, forma de entrega…"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
              {problemas.length > 0 && <p className="text-sm text-amber-700 dark:text-amber-400">Ajuste os itens destacados para continuar.</p>}
              <button
                type="button"
                className={`${botaoWhatsapp} w-full`}
                disabled={problemas.length > 0 || atualizando || enviando}
                aria-busy={enviando || undefined}
                onClick={enviar}
              >
                {enviando ? <Spinner className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" aria-hidden />} Enviar pedido pelo WhatsApp
              </button>
            </>
          )}
          <Link to="/loja" className="block text-center text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
            Continuar comprando
          </Link>
        </aside>
      </div>
    </>
  )
}
