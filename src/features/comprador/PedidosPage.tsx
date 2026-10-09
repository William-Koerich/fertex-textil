import { useState } from 'react'
import { Link } from 'react-router'
import { ClipboardList, MessageCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useAsync } from '@/lib/useAsync'
import { mensagemErro } from '@/lib/errors'
import { cancelarPedido, listarMeusPedidos, STATUS_PEDIDO } from '@/lib/pedidos'
import type { MeuPedido } from '@/lib/pedidos'
import { codigoPedido, linkWhatsapp, mensagemPedido } from '@/lib/whatsapp'
import { formatarDataHora, formatarMoeda, formatarNumero } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { buttonClass } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProdutoFoto } from '@/components/ProdutoFoto'
import { formatarPrecoPor, formatarQuantidade } from '@/lib/unidades'


export default function PedidosPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload, setData } = useAsync(listarMeusPedidos, [])
  const [cancelando, setCancelando] = useState<MeuPedido | null>(null)
  const [processando, setProcessando] = useState(false)

  async function confirmarCancelamento() {
    if (!cancelando) return
    setProcessando(true)
    try {
      await cancelarPedido(cancelando.id)
      setData((l) => l?.map((p) => (p.id === cancelando.id ? { ...p, status: 'cancelado' } : p)))
      toast('Pedido cancelado.')
    } catch (e) {
      toast(mensagemErro(e), 'erro')
    } finally {
      setProcessando(false)
      setCancelando(null)
    }
  }

  return (
    <>
      <PageHeader title="Meus pedidos" subtitle={data?.length ? `${formatarNumero(data.length)} pedido(s)` : undefined} />
      {loading ? (
        <LoadingState label="Carregando pedidos…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="Você ainda não fez pedidos"
          description="Quando você enviar um pedido pelo WhatsApp, ele aparece aqui."
          action={
            <Link to="/loja" className={buttonClass('primary')}>
              Ir para a loja
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {data.map((p) => {
            const st = STATUS_PEDIDO[p.status]
            const qtd = p.itens.length
            return (
              <li key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-semibold">
                      Pedido #{codigoPedido(p.id)}
                      {p.vendedor_nome && <span className="font-normal text-slate-500 dark:text-slate-400"> · {p.vendedor_nome}</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatarDataHora(p.criado_em)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                </div>
                <ul className="divide-y divide-slate-100 px-4 dark:divide-slate-800">
                  {p.itens.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2.5">
                      <ProdutoFoto url={i.foto_url} nome={i.nome} className="h-12 w-12 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.nome}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatarQuantidade(i.quantidade, i.unidade)} × {formatarPrecoPor(i.preco_unitario, i.unidade)}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums">{formatarMoeda(i.quantidade * i.preco_unitario)}</span>
                    </li>
                  ))}
                </ul>
                {p.observacao && <p className="px-4 pb-2 text-sm text-slate-500 dark:text-slate-400">Observação: {p.observacao}</p>}
                <div className="flex justify-between bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatarNumero(qtd)} {qtd === 1 ? 'produto' : 'produtos'}
                  </span>
                  <span className="font-bold">Total {formatarMoeda(p.total)}</span>
                </div>
                {p.status === 'pendente' && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    {p.vendedor_whatsapp && p.vendedor_nome && (
                      <a
                        href={linkWhatsapp(
                          p.vendedor_whatsapp,
                          mensagemPedido({ pedido_id: p.id, vendedor_nome: p.vendedor_nome, total: p.total, itens: p.itens, observacao: p.observacao }, profile?.nome ?? ''),
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-[#1f8a4c] px-3 py-2 text-sm font-semibold text-white hover:bg-[#18733f]"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden /> Falar no WhatsApp
                      </a>
                    )}
                    <button type="button" onClick={() => setCancelando(p)} className={buttonClass('ghost', 'px-3 py-2 text-red-600 dark:text-red-400')}>
                      Cancelar pedido
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!cancelando}
        title="Cancelar pedido?"
        confirmLabel="Cancelar pedido"
        danger
        loading={processando}
        onConfirm={confirmarCancelamento}
        onCancel={() => setCancelando(null)}
      >
        <p>O vendedor verá o pedido #{cancelando && codigoPedido(cancelando.id)} como cancelado.</p>
      </ConfirmDialog>
    </>
  )
}
