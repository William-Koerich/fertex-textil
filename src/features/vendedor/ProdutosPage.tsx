import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Package, Pencil, Plus, Search, Trash } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useAsync } from '@/lib/useAsync'
import { mensagemErro } from '@/lib/errors'
import { ESTOQUE_BAIXO, excluirProduto, listarMeusProdutos } from '@/lib/produtos'
import type { Produto } from '@/lib/produtos'
import { formatarMoeda, formatarNumero } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { buttonClass, IconButton } from '@/components/ui/Button'
import { inputClass } from '@/components/ui/Field'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProdutoFoto } from '@/components/ProdutoFoto'

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function StatusBadge({ produto }: { produto: Produto }) {
  if (!produto.ativo)
    return (
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
        Inativo
      </span>
    )
  if (produto.estoque === 0)
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
        Esgotado
      </span>
    )
  if (produto.estoque <= ESTOQUE_BAIXO)
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Estoque baixo
      </span>
    )
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      Ativo
    </span>
  )
}

export default function ProdutosPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload, setData } = useAsync(() => listarMeusProdutos(profile!.id), [profile?.id])
  const [busca, setBusca] = useState('')
  const [excluindo, setExcluindo] = useState<Produto | null>(null)
  const [processando, setProcessando] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim())
    if (!q) return data ?? []
    return (data ?? []).filter((p) => normalizar(`${p.nome} ${p.categoria} ${p.descricao}`).includes(q))
  }, [data, busca])

  async function confirmarExclusao() {
    if (!excluindo) return
    setProcessando(true)
    try {
      await excluirProduto(excluindo)
      setData((lista) => lista?.filter((p) => p.id !== excluindo.id))
      toast(`"${excluindo.nome}" foi excluído.`)
      setExcluindo(null)
    } catch (e) {
      toast(mensagemErro(e), 'erro')
      setExcluindo(null)
    } finally {
      setProcessando(false)
    }
  }

  const novo = (
    <Link to="/produtos/novo" className={buttonClass('primary')}>
      <Plus className="h-4 w-4" aria-hidden /> Novo produto
    </Link>
  )

  return (
    <>
      <PageHeader
        title="Meus produtos"
        subtitle={data ? `${formatarNumero(data.length)} produto(s) cadastrado(s)` : undefined}
        actions={novo}
      />

      {loading ? (
        <LoadingState label="Carregando produtos…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto ainda"
          description="Cadastre seu primeiro produto para que ele apareça na vitrine dos compradores."
          action={novo}
        />
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, categoria ou descrição"
              aria-label="Buscar produtos"
              className={`${inputClass()} pl-10`}
            />
          </div>

          {!filtrados.length ? (
            <EmptyState icon={Search} title="Nenhum produto encontrado" description={`Nada corresponde a "${busca}".`} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtrados.map((p) => (
                <li
                  key={p.id}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <ProdutoFoto url={p.foto_url} nome={p.nome} className="h-20 w-20 shrink-0 rounded-lg" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-2 font-semibold">{p.nome}</h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{p.categoria}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm">
                      <span className="font-semibold">{formatarMoeda(p.preco)}</span>
                      <span className="text-slate-500 dark:text-slate-400">Estoque: {formatarNumero(p.estoque)}</span>
                      <StatusBadge produto={p} />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <Link
                      to={`/produtos/${p.id}/editar`}
                      aria-label={`Editar ${p.nome}`}
                      title="Editar"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-5 w-5" />
                    </Link>
                    <IconButton
                      onClick={() => setExcluindo(p)}
                      aria-label={`Excluir ${p.nome}`}
                      title="Excluir"
                      className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <Trash className="h-5 w-5" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!excluindo}
        title="Excluir produto?"
        confirmLabel="Excluir"
        danger
        loading={processando}
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluindo(null)}
      >
        <p>
          <strong>{excluindo?.nome}</strong> será removido permanentemente. Esta ação não pode ser desfeita.
        </p>
      </ConfirmDialog>
    </>
  )
}
