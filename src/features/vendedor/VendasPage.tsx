import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { HandCoins, Receipt } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAsync } from '@/lib/useAsync'
import { listarVendas } from '@/lib/pedidos'
import { listarMeusProdutos } from '@/lib/produtos'
import { formatarDataHora, formatarMoeda, formatarNumero } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/contexts/ToastContext'
import { RegistrarVendaDialog } from './RegistrarVendaDialog'
import type { Venda } from '@/lib/pedidos'
import { Select } from '@/components/ui/Field'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { intervaloDoPreset, PeriodoFiltro, PRESETS } from '@/components/PeriodoFiltro'
import type { Preset } from '@/components/PeriodoFiltro'
import { formatarPrecoPor, formatarQuantidade } from '@/lib/unidades'

/** Nome do comprador (loja) ou do cliente da venda direta, com selo para vendas registradas manualmente */
function Cliente({ v }: { v: Venda }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{v.comprador_nome ?? (v.origem === 'manual' ? 'Cliente não informado' : '—')}</span>
      {v.origem !== 'loja' && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {v.origem === 'manual' ? 'Venda direta' : 'WhatsApp'}
        </span>
      )}
    </span>
  )
}

export default function VendasPage() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const presetParam = params.get('periodo') as Preset | null
  const preset: Preset = PRESETS.some((p) => p.valor === presetParam) ? presetParam! : '30'
  const { inicio, fim } = intervaloDoPreset(preset, params.get('de') ?? '', params.get('ate') ?? '')
  const produtoId = params.get('produto') ?? ''

  const produtos = useAsync(() => listarMeusProdutos(profile!.id), [profile?.id])
  const vendas = useAsync(() => listarVendas({ inicio, fim, produtoId }), [inicio, fim, produtoId])
  const toast = useToast()
  const [registrando, setRegistrando] = useState(false)

  const totais = useMemo(() => {
    const lista = vendas.data ?? []
    return {
      quantidade: lista.reduce((s, v) => s + v.quantidade, 0),
      itens: lista.length,
      // Só soma quantidades no rodapé se todas forem da mesma unidade
      unidade: new Set(lista.map((v) => v.unidade)).size === 1 ? lista[0].unidade : null,
      valor: lista.reduce((s, v) => s + Number(v.total), 0),
      pedidos: new Set(lista.map((v) => v.pedido_id)).size,
    }
  }, [vendas.data])

  const atualizar = (mudancas: Record<string, string>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(mudancas)) v ? p.set(k, v) : p.delete(k)
        return p
      },
      { replace: true },
    )

  const nomePeriodo = PRESETS.find((p) => p.valor === preset)?.label.toLowerCase()

  return (
    <>
      <PageHeader
        title="Produtos vendidos"
        subtitle="Cada item vendido, com comprador e valores."
        actions={
          <Button onClick={() => setRegistrando(true)} disabled={produtos.loading}>
            <HandCoins className="h-4 w-4" aria-hidden /> Registrar venda
          </Button>
        }
      />
      <RegistrarVendaDialog
        open={registrando}
        produtos={produtos.data}
        onClose={() => setRegistrando(false)}
        onRegistrada={(produto, quantidade) => {
          toast(`Venda registrada: ${quantidade} × ${produto.nome}.`)
          setRegistrando(false)
          vendas.reload()
          produtos.reload()
        }}
      />

      <div className="mb-5 space-y-3">
        <PeriodoFiltro
          preset={preset}
          inicio={inicio}
          fim={fim}
          onChange={(v) => atualizar({ periodo: v.preset, de: v.preset === 'custom' ? v.inicio : '', ate: v.preset === 'custom' ? v.fim : '' })}
        />
        <div className="sm:max-w-xs">
          <Select label="Produto" value={produtoId} onChange={(e) => atualizar({ produto: e.target.value })} disabled={produtos.loading}>
            <option value="">Todos os produtos</option>
            {produtos.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {vendas.loading ? (
        <LoadingState label="Carregando vendas…" />
      ) : vendas.error ? (
        <ErrorState message={vendas.error} onRetry={vendas.reload} />
      ) : !vendas.data?.length ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma venda no período"
          description={produtoId ? 'Não há vendas deste produto no período selecionado.' : 'Quando alguém comprar seus produtos, as vendas aparecem aqui.'}
        />
      ) : (
        <>
          {/* Celular: cartões */}
          <ul className="space-y-2 md:hidden">
            {vendas.data.map((v) => (
              <li key={v.item_id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{v.produto_nome}</span>
                  <span className="font-semibold whitespace-nowrap">{formatarMoeda(Number(v.total))}</span>
                </div>
                <div className="mt-1 flex justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span>
                    {formatarQuantidade(v.quantidade, v.unidade)} × {formatarPrecoPor(Number(v.preco_unitario), v.unidade)}
                  </span>
                  <span>{formatarDataHora(v.data)}</span>
                </div>
                <p className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Cliente v={v} />
                </p>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-sm">
              <caption className="sr-only">Vendas do período</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3">Data</th>
                  <th scope="col" className="px-4 py-3">Produto</th>
                  <th scope="col" className="px-4 py-3">Comprador</th>
                  <th scope="col" className="px-4 py-3 text-right">Qtd.</th>
                  <th scope="col" className="px-4 py-3 text-right">Preço unit.</th>
                  <th scope="col" className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vendas.data.map((v) => (
                  <tr key={v.item_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">{formatarDataHora(v.data)}</td>
                    <td className="px-4 py-3 font-medium">{v.produto_nome}</td>
                    <td className="px-4 py-3">
                      <Cliente v={v} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatarQuantidade(v.quantidade, v.unidade)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatarPrecoPor(Number(v.preco_unitario), v.unidade)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatarMoeda(Number(v.total))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/50">
                <tr>
                  <td className="px-4 py-3" colSpan={3}>
                    Total do período ({formatarNumero(totais.pedidos)} {totais.pedidos === 1 ? 'pedido' : 'pedidos'})
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatarNumero(totais.quantidade)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right tabular-nums">{formatarMoeda(totais.valor)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Rodapé fixo no celular */}
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Total ({nomePeriodo}) · {formatarNumero(totais.itens)} {totais.itens === 1 ? 'venda' : 'vendas'}
              </span>
              <span className="text-lg font-bold">{formatarMoeda(totais.valor)}</span>
            </div>
          </div>
          <div className="h-16 md:hidden" aria-hidden />
        </>
      )}
    </>
  )
}
