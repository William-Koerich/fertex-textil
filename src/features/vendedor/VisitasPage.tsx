import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bot, Eye, MapPin, Share2, Users } from 'lucide-react'
import { useAsync } from '@/lib/useAsync'
import { carregarEstatisticas, formatarLocal, ROTULO_ORIGEM } from '@/lib/visitas'
import type { EstatisticasVisitas } from '@/lib/visitas'
import { formatarDataHora, formatarDiaMes, formatarDiaSemana, formatarNumero } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { buttonClass } from '@/components/ui/Button'
import { IconeOrigem } from '@/components/IconesRedes'

const PERIODOS = [7, 30, 90] as const
const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'

function Tile({ label, valor, icone: Icone }: { label: string; valor: number; icone: typeof Eye }) {
  return (
    <div className={card}>
      <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        <Icone className="h-4 w-4" aria-hidden /> {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{formatarNumero(valor)}</p>
    </div>
  )
}

/** Lista com barra proporcional (origens, cidades, produtos) */
function ListaBarras({ itens }: { itens: { chave: string; rotulo: ReactNode; valor: number }[] }) {
  const max = Math.max(1, ...itens.map((i) => i.valor))
  return (
    <ol className="space-y-3">
      {itens.map((i) => (
        <li key={i.chave}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{i.rotulo}</span>
            <span className="shrink-0 font-semibold tabular-nums">{formatarNumero(i.valor)}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
            <div className="h-2 rounded-full" style={{ width: `${(i.valor / max) * 100}%`, background: 'var(--chart-accent)' }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

function ticksInteiros(max: number) {
  if (max <= 4) return [0, 1, 2, 3, 4]
  const bruto = max / 4
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => Math.max(1, Math.round(m * mag))).find((p) => p >= bruto)!
  return Array.from({ length: Math.ceil(max / passo) + 1 }, (_, i) => i * passo)
}

function TooltipVisitas({ active, payload }: { active?: boolean; payload?: { payload: EstatisticasVisitas['serie'][number] }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="font-semibold">
        {formatarNumero(p.visitas)} {p.visitas === 1 ? 'visita' : 'visitas'}
      </p>
      <p className="text-xs text-slate-500 capitalize dark:text-slate-400">{formatarDiaSemana(p.dia)}</p>
    </div>
  )
}

export default function VisitasPage() {
  const [params, setParams] = useSearchParams()
  const diasParam = Number(params.get('dias'))
  const dias = (PERIODOS as readonly number[]).includes(diasParam) ? diasParam : 30
  const { data: e, loading, error, reload } = useAsync(() => carregarEstatisticas(dias), [dias])
  const max = e ? Math.max(0, ...e.serie.map((s) => s.visitas)) : 0
  const ticks = ticksInteiros(max)

  return (
    <>
      <PageHeader
        title="Visitas"
        subtitle="Quantas pessoas abriram a sua loja e os seus produtos, de onde vieram e de qual cidade."
        actions={
          <Link to="/perfil" className={buttonClass('secondary')}>
            <Share2 className="h-4 w-4" aria-hidden /> Compartilhar loja
          </Link>
        }
      />

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

      {!e && loading ? (
        <LoadingState label="Carregando visitas…" />
      ) : error && !e ? (
        <ErrorState message={error} onRetry={reload} />
      ) : e && e.visitas === 0 ? (
        <EmptyState
          icon={Eye}
          title="Nenhuma visita no período"
          description="Compartilhe o link da sua loja no WhatsApp, Instagram e Facebook. As visitas aparecem aqui."
          action={
            <Link to="/perfil" className={buttonClass('primary')}>
              <Share2 className="h-4 w-4" aria-hidden /> Compartilhar minha loja
            </Link>
          }
        />
      ) : e ? (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="Visitas" valor={e.visitas} icone={Eye} />
            <Tile label="Pessoas" valor={e.visitantes} icone={Users} />
            <Tile label="Cidades" valor={e.cidades} icone={MapPin} />
          </div>
          {e.robos > 0 && (
            <p className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Bot className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {formatarNumero(e.robos)} {e.robos === 1 ? 'acesso de robô foi ignorado' : 'acessos de robôs foram ignorados'} (servidores do Facebook,
              Instagram, WhatsApp, Amazon, Google…, que abrem o link para montar a prévia quando ele é compartilhado).
            </p>
          )}

          <section className={card} aria-labelledby="titulo-visitas-dia">
            <h2 id="titulo-visitas-dia" className="font-semibold">
              Visitas por dia
            </h2>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Últimos {dias} dias</p>
            <div className="h-56" role="img" aria-label={`Gráfico de visitas por dia nos últimos ${dias} dias: ${e.visitas} visitas.`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={e.serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
                  <XAxis dataKey="dia" tickFormatter={formatarDiaMes} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} minTickGap={24} />
                  <YAxis ticks={ticks} domain={[0, ticks[ticks.length - 1]]} allowDecimals={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip content={<TooltipVisitas />} cursor={{ fill: 'var(--chart-grid)', opacity: 0.5 }} />
                  <Bar dataKey="visitas" fill="var(--chart-accent)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className={card} aria-labelledby="titulo-origens">
              <h2 id="titulo-origens" className="mb-4 font-semibold">
                De onde vieram
              </h2>
              <ListaBarras
                itens={e.origens.map((o) => ({
                  chave: o.origem,
                  valor: o.visitas,
                  rotulo: (
                    <span className="inline-flex items-center gap-2">
                      <IconeOrigem origem={o.origem} className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      {ROTULO_ORIGEM[o.origem]}
                    </span>
                  ),
                }))}
              />
            </section>

            <section className={card} aria-labelledby="titulo-locais">
              <h2 id="titulo-locais" className="mb-4 font-semibold">
                Cidades
              </h2>
              {e.locais.length ? (
                <ListaBarras itens={e.locais.map((l, i) => ({ chave: String(i), valor: l.visitas, rotulo: formatarLocal(l) }))} />
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Localizando… volte em alguns instantes.</p>
              )}
              {e.localizando > 0 && e.locais.length > 0 && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{formatarNumero(e.localizando)} visita(s) ainda sendo localizadas.</p>
              )}
            </section>

            <section className={card} aria-labelledby="titulo-produtos-vistos">
              <h2 id="titulo-produtos-vistos" className="mb-4 font-semibold">
                Produtos mais vistos
              </h2>
              {e.produtos.length ? (
                <ListaBarras itens={e.produtos.map((p) => ({ chave: p.produto_id, valor: p.visitas, rotulo: p.nome }))} />
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Ninguém abriu um produto ainda; as visitas foram só na loja.</p>
              )}
            </section>
          </div>

          <section className={card} aria-labelledby="titulo-ultimas">
            <h2 id="titulo-ultimas" className="mb-3 font-semibold">
              Últimas visitas
            </h2>
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">Quando</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Página</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Veio de</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Local</th>
                    <th scope="col" className="py-2 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {e.ultimas.map((u, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-500 dark:text-slate-400">{formatarDataHora(u.criado_em)}</td>
                      <td className="max-w-48 truncate py-2 pr-3">{u.produto ?? 'Loja'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <IconeOrigem origem={u.origem} className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          {ROTULO_ORIGEM[u.origem]}
                        </span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatarLocal(u) ?? (u.localizando ? 'Localizando…' : '—')}</td>
                      <td className="py-2 font-mono text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">{u.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              A localização é aproximada (pelo IP da operadora) e o IP aparece parcialmente oculto para proteger a privacidade dos visitantes.
            </p>
          </section>
        </div>
      ) : null}
    </>
  )
}
