import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, TriangleAlert } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAsync } from '@/lib/useAsync'
import { carregarDashboard } from '@/lib/dashboard'
import type { Dashboard } from '@/lib/dashboard'
import {
  formatarDiaMes,
  formatarDiaSemana,
  formatarMes,
  formatarMoeda,
  formatarMoedaCompacta,
  formatarNumero,
} from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'

const PERIODOS = [7, 30, 90] as const

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'

function Delta({ atual, anterior, dias }: { atual: number; anterior: number; dias: number }) {
  const titulo = `Comparado aos ${dias} dias anteriores`
  if (anterior === 0) return null
  const pct = ((atual - anterior) / anterior) * 100
  const sobe = pct >= 0
  const Icone = sobe ? ArrowUpRight : ArrowDownRight
  return (
    <p title={titulo} className={`mt-1 inline-flex items-center gap-0.5 text-xs font-medium ${sobe ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
      <Icone className="h-3.5 w-3.5" aria-hidden />
      {sobe ? '+' : ''}
      {pct.toFixed(0)}% <span className="font-normal text-slate-500 dark:text-slate-400">vs. anterior</span>
    </p>
  )
}

function StatTile({ label, valor, detalhe, children }: { label: string; valor: string; detalhe?: string; children?: ReactNode }) {
  return (
    <div className={card}>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-tight" title={valor}>
        {valor}
      </p>
      {detalhe && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detalhe}</p>}
      {children}
    </div>
  )
}

function TooltipFaturamento({ active, payload }: { active?: boolean; payload?: { payload: Dashboard['serie'][number] }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="font-semibold">{formatarMoeda(p.faturamento)}</p>
      <p className="text-xs text-slate-500 capitalize dark:text-slate-400">{formatarDiaSemana(p.dia)}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {formatarNumero(p.vendas)} {p.vendas === 1 ? 'venda' : 'vendas'}
      </p>
    </div>
  )
}

/** Ticks "redondos" para o eixo Y: passos de 1, 2, 2,5 ou 5 × 10ⁿ. */
function ticksRedondos(maximo: number, alvo = 4) {
  if (maximo <= 0) return [0, 25, 50, 75, 100]
  const bruto = maximo / alvo
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto)!
  return Array.from({ length: Math.ceil(maximo / passo) + 1 }, (_, i) => i * passo)
}

function GraficoFaturamento({ d, dias }: { d: Dashboard; dias: number }) {
  const max = d.serie.reduce((m, p) => (p.faturamento > m.faturamento ? p : m), d.serie[0])
  const ticks = ticksRedondos(max?.faturamento ?? 0)
  return (
    <section className={card} aria-labelledby="titulo-grafico">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="titulo-grafico" className="font-semibold">
            Faturamento por dia
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Últimos {dias} dias · {formatarMoeda(d.faturamento_periodo)}
          </p>
        </div>
        {max && max.faturamento > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Melhor dia: <span className="font-medium text-slate-700 dark:text-slate-200">{formatarDiaMes(max.dia)}</span> ({formatarMoeda(max.faturamento)})
          </p>
        )}
      </div>
      <div className="h-64" role="img" aria-label={`Gráfico de faturamento por dia nos últimos ${dias} dias. Total ${formatarMoeda(d.faturamento_periodo)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={d.serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
            <XAxis
              dataKey="dia"
              tickFormatter={formatarDiaMes}
              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={formatarMoedaCompacta}
              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={64}
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1]]}
            />
            <Tooltip content={<TooltipFaturamento />} cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} />
            <Area
              type="linear"
              dataKey="faturamento"
              stroke="var(--chart-accent)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="var(--chart-accent)"
              fillOpacity={0.1}
              activeDot={{ r: 5, fill: 'var(--chart-accent)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Ver dados em tabela</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full">
            <thead className="text-left text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th scope="col" className="py-1">Dia</th>
                <th scope="col" className="py-1 text-right">Vendas</th>
                <th scope="col" className="py-1 text-right">Faturamento</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {d.serie
                .filter((p) => p.faturamento > 0)
                .map((p) => (
                  <tr key={p.dia} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1 capitalize">{formatarDiaSemana(p.dia)}</td>
                    <td className="py-1 text-right">{formatarNumero(p.vendas)}</td>
                    <td className="py-1 text-right">{formatarMoeda(p.faturamento)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

function RankingProdutos({ d, dias }: { d: Dashboard; dias: number }) {
  const max = Math.max(1, ...d.top_produtos.map((p) => p.quantidade))
  return (
    <section className={card} aria-labelledby="titulo-ranking">
      <h2 id="titulo-ranking" className="font-semibold">
        Mais vendidos
      </h2>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Top 5 por unidades · {dias} dias</p>
      {!d.top_produtos.length ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma venda no período.</p>
      ) : (
        <ol className="space-y-4">
          {d.top_produtos.map((p, i) => (
            <li key={p.produto_id} title={`${p.nome}: ${p.quantidade} un. · ${formatarMoeda(p.faturamento)}`}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="mr-2 text-slate-400 tabular-nums">{i + 1}.</span>
                  <span className="font-medium">{p.nome}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{formatarNumero(p.quantidade)} un.</span>
                  <span className="ml-2 text-slate-500 dark:text-slate-400">{formatarMoeda(p.faturamento)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
                <div className="h-2 rounded-full" style={{ width: `${(p.quantidade / max) * 100}%`, background: 'var(--chart-accent)' }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function EstoqueBaixo({ d }: { d: Dashboard }) {
  return (
    <section className={card} aria-labelledby="titulo-estoque">
      <h2 id="titulo-estoque" className="mb-3 font-semibold">
        Estoque baixo
      </h2>
      {!d.estoque_baixo.length ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Todos os produtos ativos estão com estoque saudável.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {d.estoque_baixo.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <Link to={`/produtos/${p.id}/editar`} className="min-w-0 truncate font-medium hover:underline">
                {p.nome}
              </Link>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  p.estoque === 0
                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                <TriangleAlert className="h-3 w-3" aria-hidden />
                {p.estoque === 0 ? 'Esgotado' : `${formatarNumero(p.estoque)} un.`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const diasParam = Number(params.get('dias'))
  const dias = (PERIODOS as readonly number[]).includes(diasParam) ? diasParam : 30
  const { data: d, loading, error, reload } = useAsync(() => carregarDashboard(dias), [dias])

  const ticket = d && d.vendas_periodo ? d.faturamento_periodo / d.vendas_periodo : 0
  const ticketAnterior = d && d.vendas_periodo_anterior ? d.faturamento_periodo_anterior / d.vendas_periodo_anterior : 0
  const primeiroNome = profile?.nome.split(' ')[0]

  return (
    <>
      <PageHeader title="Painel" subtitle={`Olá, ${primeiroNome}! Veja como estão suas vendas.`} />

      {/* Filtro de período: uma linha acima de tudo que ele afeta */}
      <div className="mb-5 flex gap-2" role="group" aria-label="Período">
        {PERIODOS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={dias === p}
            onClick={() => setParams({ dias: String(p) }, { replace: true })}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              dias === p
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {p} dias
          </button>
        ))}
      </div>

      {!d && loading ? (
        <LoadingState label="Carregando painel…" />
      ) : error && !d ? (
        <ErrorState message={error} onRetry={reload} />
      ) : d ? (
        // Ao trocar o período, mantém o conteúdo anterior esmaecido em vez de piscar
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Faturamento total" valor={formatarMoeda(d.faturamento_total)} detalhe="Desde o início" />
            <StatTile label="Faturamento do mês" valor={formatarMoeda(d.faturamento_mes)} detalhe={`Em ${formatarMes(d.fim)}`} />
            <StatTile label="Vendas" valor={formatarNumero(d.vendas_periodo)} detalhe={`${formatarNumero(d.itens_periodo)} itens · ${dias} dias`}>
              <Delta atual={d.vendas_periodo} anterior={d.vendas_periodo_anterior} dias={dias} />
            </StatTile>
            <StatTile label="Ticket médio" valor={formatarMoeda(ticket)} detalhe={`${dias} dias`}>
              {ticket > 0 && <Delta atual={ticket} anterior={ticketAnterior} dias={dias} />}
            </StatTile>
            <Link
              to="/produtos"
              className={`${card} col-span-2 block transition-colors hover:border-amber-300 lg:col-span-1 dark:hover:border-amber-800`}
            >
              <p className="text-sm text-slate-500 dark:text-slate-400">Estoque baixo</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                {formatarNumero(d.estoque_baixo.length)}
                {d.estoque_baixo.length > 0 && <TriangleAlert className="h-5 w-5 text-amber-500" aria-hidden />}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {d.estoque_baixo.length ? 'produtos com 5 un. ou menos' : 'Nenhum produto em alerta'}
              </p>
            </Link>
          </div>

          <GraficoFaturamento d={d} dias={dias} />

          <div className="grid gap-4 lg:grid-cols-2">
            <RankingProdutos d={d} dias={dias} />
            <EstoqueBaixo d={d} />
          </div>
        </div>
      ) : null}
    </>
  )
}
