import { Link, useLocation } from 'react-router'
import { ClipboardList } from 'lucide-react'
import { useAsync } from '@/lib/useAsync'
import { listarMeusPedidos } from '@/lib/pedidos'
import type { StatusPedido } from '@db/schema'
import { formatarDataHora, formatarMoeda, formatarNumero } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { buttonClass } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ProdutoFoto } from '@/components/ProdutoFoto'

const STATUS: Record<StatusPedido, { label: string; cls: string }> = {
  concluido: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
}

export default function PedidosPage() {
  const { data, loading, error, reload } = useAsync(listarMeusPedidos, [])
  const novoPedido = (useLocation().state as { novoPedido?: string } | null)?.novoPedido

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
          description="Quando você finalizar uma compra, ela aparece aqui."
          action={
            <Link to="/loja" className={buttonClass('primary')}>
              Ir para a loja
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {data.map((p) => {
            const st = STATUS[p.status]
            const novo = p.id === novoPedido
            const qtd = p.itens.reduce((s, i) => s + i.quantidade, 0)
            return (
              <li
                key={p.id}
                className={`overflow-hidden rounded-xl border bg-white dark:bg-slate-900 ${
                  novo ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-semibold">
                      Pedido #{p.id.slice(0, 8).toUpperCase()}
                      {novo && <span className="ml-2 text-xs font-medium text-brand-600 dark:text-brand-400">Novo</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatarDataHora(p.criado_em)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                </div>
                <ul className="divide-y divide-slate-100 px-4 dark:divide-slate-800">
                  {p.itens.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2.5">
                      <ProdutoFoto url={i.produto?.foto_url ?? null} nome={i.produto?.nome ?? 'Produto'} className="h-12 w-12 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.produto?.nome ?? 'Produto indisponível'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatarNumero(i.quantidade)} × {formatarMoeda(i.preco_unitario)}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums">{formatarMoeda(i.quantidade * i.preco_unitario)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatarNumero(qtd)} {qtd === 1 ? 'item' : 'itens'}
                  </span>
                  <span className="font-bold">Total {formatarMoeda(p.total)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
