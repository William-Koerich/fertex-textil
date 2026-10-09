import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Check, Inbox, X } from 'lucide-react'
import type { StatusPedido } from '@db/schema'
import { useToast } from '@/contexts/ToastContext'
import { useAsync } from '@/lib/useAsync'
import { mensagemErro } from '@/lib/errors'
import { cancelarPedido, concluirPedido, listarPedidosRecebidos, STATUS_PEDIDO } from '@/lib/pedidos'
import type { PedidoRecebido } from '@/lib/pedidos'
import { codigoPedido } from '@/lib/whatsapp'
import { formatarDataHora, formatarMoeda } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProdutoFoto } from '@/components/ProdutoFoto'
import { EVENTO_PEDIDOS } from '@/components/layout/PerfilLayouts'
import { formatarPrecoPor, formatarQuantidade } from '@/lib/unidades'

const ABAS: { valor: StatusPedido; label: string }[] = [
  { valor: 'pendente', label: 'Aguardando' },
  { valor: 'concluido', label: 'Vendidos' },
  { valor: 'cancelado', label: 'Cancelados' },
]

type Acao = { tipo: 'vender' | 'cancelar'; pedido: PedidoRecebido }

/** Pedidos enviados pelos compradores via WhatsApp. O vendedor marca como vendido (baixa o estoque) ou cancela. */
export default function PedidosRecebidosPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const aba = (ABAS.find((a) => a.valor === params.get('status'))?.valor ?? 'pendente') as StatusPedido
  const { data, loading, error, reload, setData } = useAsync(listarPedidosRecebidos, [])
  const [acao, setAcao] = useState<Acao | null>(null)
  const [processando, setProcessando] = useState(false)

  const contagem = useMemo(() => {
    const c: Record<StatusPedido, number> = { pendente: 0, concluido: 0, cancelado: 0 }
    for (const p of data ?? []) c[p.status]++
    return c
  }, [data])
  const lista = (data ?? []).filter((p) => p.status === aba)

  async function confirmar() {
    if (!acao) return
    setProcessando(true)
    try {
      if (acao.tipo === 'vender') await concluirPedido(acao.pedido.id)
      else await cancelarPedido(acao.pedido.id)
      const novoStatus: StatusPedido = acao.tipo === 'vender' ? 'concluido' : 'cancelado'
      setData((l) => l?.map((p) => (p.id === acao.pedido.id ? { ...p, status: novoStatus } : p)))
      toast(acao.tipo === 'vender' ? `Pedido #${codigoPedido(acao.pedido.id)} marcado como vendido. Estoque atualizado.` : 'Pedido cancelado.')
      window.dispatchEvent(new Event(EVENTO_PEDIDOS))
    } catch (e) {
      toast(mensagemErro(e), 'erro')
      reload()
    } finally {
      setProcessando(false)
      setAcao(null)
    }
  }

  return (
    <>
      <PageHeader title="Pedidos recebidos" subtitle="Pedidos enviados pelos clientes no WhatsApp. Depois de combinar, marque como vendido." />

      <div className="mb-4 flex gap-2 overflow-x-auto" role="tablist" aria-label="Situação do pedido">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            role="tab"
            aria-selected={aba === a.valor}
            onClick={() => setParams(a.valor === 'pendente' ? {} : { status: a.valor }, { replace: true })}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              aba === a.valor
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {a.label}
            {data && <span className={`text-xs ${aba === a.valor ? 'text-brand-100' : 'text-slate-400'}`}>{contagem[a.valor]}</span>}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <LoadingState label="Carregando pedidos…" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !lista.length ? (
        <EmptyState
          icon={Inbox}
          title={aba === 'pendente' ? 'Nenhum pedido aguardando' : aba === 'concluido' ? 'Nenhum pedido vendido' : 'Nenhum pedido cancelado'}
          description={aba === 'pendente' ? 'Quando um cliente enviar um pedido pelo WhatsApp, ele aparece aqui para você confirmar.' : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => {
            const st = STATUS_PEDIDO[p.status]
            const faltaEstoque = p.status === 'pendente' && p.itens.some((i) => i.excluido || i.estoque < i.quantidade)
            return (
              <li key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div>
                    <p className="font-semibold">{p.comprador_nome ?? 'Cliente'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pedido #{codigoPedido(p.id)} · {formatarDataHora(p.criado_em)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                </div>
                <ul className="divide-y divide-slate-100 px-4 dark:divide-slate-800">
                  {p.itens.map((i) => (
                    <li key={`${i.produto_id}|${i.cor ?? ''}`} className="flex items-center gap-3 py-2.5">
                      <ProdutoFoto url={i.foto_url} nome={i.nome} className="h-12 w-12 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {i.nome}
                          {i.cor && <span className="font-normal text-slate-500 dark:text-slate-400"> · {i.cor}</span>}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatarQuantidade(i.quantidade, i.unidade)} × {formatarPrecoPor(i.preco_unitario, i.unidade)}
                          {p.status === 'pendente' && (
                            <span className={i.excluido || i.estoque < i.quantidade ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
                              {' '}
                              · {i.excluido ? 'produto excluído' : `${formatarQuantidade(i.estoque, i.unidade)} em estoque`}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums">{formatarMoeda(i.quantidade * i.preco_unitario)}</span>
                    </li>
                  ))}
                </ul>
                {p.observacao && (
                  <p className="mx-4 mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <span className="font-medium">Observação:</span> {p.observacao}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                  <span className="font-bold">Total {formatarMoeda(p.total)}</span>
                  {p.status === 'pendente' && (
                    <div className="flex gap-2">
                      <Button variant="secondary" className="px-3 py-2" onClick={() => setAcao({ tipo: 'cancelar', pedido: p })}>
                        <X className="h-4 w-4" aria-hidden /> Cancelar
                      </Button>
                      <Button className="px-3 py-2" onClick={() => setAcao({ tipo: 'vender', pedido: p })} disabled={faltaEstoque}>
                        <Check className="h-4 w-4" aria-hidden /> Marcar como vendido
                      </Button>
                    </div>
                  )}
                  {p.status === 'concluido' && p.concluido_em && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">Vendido em {formatarDataHora(p.concluido_em)}</span>
                  )}
                </div>
                {faltaEstoque && (
                  <p className="px-4 pb-3 text-sm text-red-600 dark:text-red-400">
                    Estoque insuficiente ou produto excluído. Atualize o estoque ou cancele o pedido.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!acao}
        title={acao?.tipo === 'vender' ? 'Marcar como vendido?' : 'Cancelar pedido?'}
        confirmLabel={acao?.tipo === 'vender' ? 'Marcar como vendido' : 'Cancelar pedido'}
        danger={acao?.tipo === 'cancelar'}
        loading={processando}
        onConfirm={confirmar}
        onCancel={() => setAcao(null)}
      >
        {acao?.tipo === 'vender' ? (
          <p>
            O estoque dos produtos será baixado e a venda de <strong>{acao && formatarMoeda(acao.pedido.total)}</strong> entra no painel e em
            "Produtos vendidos".
          </p>
        ) : (
          <p>O pedido #{acao && codigoPedido(acao.pedido.id)} será cancelado. O estoque não é alterado.</p>
        )}
      </ConfirmDialog>
    </>
  )
}
