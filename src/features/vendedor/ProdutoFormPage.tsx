import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ImagePlus, Plus, Trash, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useAsync } from '@/lib/useAsync'
import { mensagemErro } from '@/lib/errors'
import { parseMoeda } from '@/lib/format'
import {
  atualizarProduto,
  buscarProduto,
  CATEGORIAS_SUGERIDAS,
  criarProduto,
  enviarFoto,
  removerFoto,
} from '@/lib/produtos'
import type { Produto } from '@/lib/produtos'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, buttonClass } from '@/components/ui/Button'
import { Input, inputClass, Select, Textarea } from '@/components/ui/Field'
import { siglaUnidade, UNIDADES } from '@/lib/unidades'
import type { Unidade } from '@/lib/unidades'
import { LoadingState } from '@/components/ui/Spinner'
import { Alert, EmptyState, ErrorState } from '@/components/ui/States'

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FOTO_MB = 15

interface Form {
  nome: string
  descricao: string
  preco: string
  estoque: string
  unidade: Unidade | ''
  minimo: string
  cores: string[]
  categoria: string
  ativo: boolean
}
type Erros = Partial<Record<keyof Form | 'foto', string>>

const vazio: Form = { nome: '', descricao: '', preco: '', estoque: '0', unidade: '', minimo: '', cores: [], categoria: '', ativo: true }

function paraForm(p: Produto): Form {
  return {
    nome: p.nome,
    descricao: p.descricao,
    preco: p.preco.toFixed(2).replace('.', ','),
    estoque: String(p.estoque),
    unidade: p.unidade,
    minimo: p.quantidade_minima ? String(p.quantidade_minima) : '',
    cores: p.cores ?? [],
    categoria: p.categoria,
    ativo: p.ativo,
  }
}

function validar(f: Form): Erros {
  const e: Erros = {}
  const nome = f.nome.trim()
  if (nome.length < 2) e.nome = 'Informe o nome do produto (mínimo 2 caracteres).'
  else if (nome.length > 120) e.nome = 'O nome pode ter no máximo 120 caracteres.'
  if (f.descricao.length > 2000) e.descricao = 'A descrição pode ter no máximo 2000 caracteres.'
  const preco = parseMoeda(f.preco)
  if (!f.preco.trim()) e.preco = 'Informe o preço.'
  else if (Number.isNaN(preco)) e.preco = 'Preço inválido. Use o formato 49,90.'
  else if (preco <= 0) e.preco = 'O preço deve ser maior que zero.'
  else if (preco > 9_999_999) e.preco = 'Preço muito alto.'
  if (!/^\d+$/.test(f.estoque.trim())) e.estoque = 'Informe um número inteiro igual ou maior que zero.'
  else if (Number(f.estoque) > 1_000_000) e.estoque = 'Estoque muito alto.'
  if (!f.unidade) e.unidade = 'Escolha a unidade de medida.'
  if (f.minimo.trim() && (!/^\d+$/.test(f.minimo.trim()) || Number(f.minimo) < 1))
    e.minimo = 'Informe um número inteiro maior que zero, ou deixe em branco.'
  else if (Number(f.minimo) > 1_000_000) e.minimo = 'Quantidade mínima muito alta.'
  if (!f.categoria.trim()) e.categoria = 'Informe a categoria.'
  return e
}

const MAX_CORES = 50

/** Lista de cores do produto (opcional). O estoque continua sendo do produto, não de cada cor. */
function CoresEditor({ cores, onChange }: { cores: string[]; onChange: (c: string[]) => void }) {
  const [nova, setNova] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function adicionar() {
    const cor = nova.trim().replace(/\s+/g, ' ')
    if (!cor) return
    if (cor.length > 60) return setErro('O nome da cor pode ter no máximo 60 caracteres.')
    if (cores.some((c) => c.toLocaleLowerCase('pt-BR') === cor.toLocaleLowerCase('pt-BR'))) return setErro(`A cor "${cor}" já foi adicionada.`)
    if (cores.length >= MAX_CORES) return setErro(`No máximo ${MAX_CORES} cores por produto.`)
    onChange([...cores, cor])
    setNova('')
    setErro(null)
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cores disponíveis</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          Opcional. O cliente escolhe uma destas cores ao pedir. O estoque é o mesmo para todas as cores.
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={nova}
          onChange={(e) => {
            setNova(e.target.value)
            setErro(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              adicionar()
            }
          }}
          placeholder="Ex.: Azul marinho"
          aria-label="Nome da cor"
          maxLength={60}
          className={inputClass(!!erro)}
        />
        <Button variant="secondary" onClick={adicionar} disabled={!nova.trim()}>
          <Plus className="h-4 w-4" aria-hidden /> Adicionar
        </Button>
      </div>
      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
      {cores.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Cores do produto">
          {cores.map((c) => (
            <li key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-3 text-sm dark:bg-slate-800">
              {c}
              <button
                type="button"
                onClick={() => onChange(cores.filter((x) => x !== c))}
                aria-label={`Remover cor ${c}`}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">Sem variação de cor.</p>
      )}
    </div>
  )
}

export default function ProdutoFormPage() {
  const { id } = useParams()
  const editando = !!id
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const carregamento = useAsync(() => (id ? buscarProduto(id) : Promise.resolve(null)), [id])
  const original = carregamento.data

  const [form, setForm] = useState<Form>(vazio)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removerFotoAtual, setRemoverFotoAtual] = useState(false)
  const inputFoto = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (original) setForm(paraForm(original))
  }, [original])

  useEffect(() => {
    if (!arquivo) return setPreview(null)
    const url = URL.createObjectURL(arquivo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErro(null)
    if (erros[k]) setErros((e) => ({ ...e, [k]: undefined }))
  }

  function escolherFoto(f: File | undefined) {
    if (!f) return
    if (!TIPOS_FOTO.includes(f.type)) {
      setErros((e) => ({ ...e, foto: 'Formato não suportado. Use JPG, PNG ou WebP.' }))
      return
    }
    if (f.size > MAX_FOTO_MB * 1024 * 1024) {
      setErros((e) => ({ ...e, foto: `A foto deve ter no máximo ${MAX_FOTO_MB} MB.` }))
      return
    }
    setErros((e) => ({ ...e, foto: undefined }))
    setArquivo(f)
    setRemoverFotoAtual(false)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const v = validar(form)
    setErros(v)
    if (Object.keys(v).length) {
      setErro('Corrija os campos destacados.')
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setErro(null)
    setSalvando(true)

    let novaFoto: string | null = null
    try {
      if (arquivo) novaFoto = await enviarFoto(profile!.id, arquivo)
      const fotoAtual = original?.foto_url ?? null
      const foto_url = novaFoto ?? (removerFotoAtual ? null : fotoAtual)
      const dados = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        preco: parseMoeda(form.preco),
        estoque: Number(form.estoque),
        unidade: form.unidade as Unidade,
        // 1 ou vazio = sem mínimo
        quantidade_minima: Number(form.minimo) > 1 ? Number(form.minimo) : null,
        cores: form.cores,
        categoria: form.categoria.trim(),
        ativo: form.ativo,
        foto_url,
      }
      if (id) await atualizarProduto(id, dados)
      else await criarProduto(profile!.id, dados)
      // Apaga a foto antiga se foi trocada ou removida
      if (fotoAtual && fotoAtual !== foto_url) removerFoto(fotoAtual).catch(() => {})
      toast(editando ? 'Produto atualizado.' : 'Produto cadastrado.')
      navigate('/produtos')
    } catch (err) {
      if (novaFoto) removerFoto(novaFoto).catch(() => {})
      setErro(mensagemErro(err))
      setSalvando(false)
    }
  }

  const titulo = editando ? 'Editar produto' : 'Novo produto'
  const voltar = (
    <Link to="/produtos" className={buttonClass('ghost', '-ml-3 mb-2')}>
      <ArrowLeft className="h-4 w-4" aria-hidden /> Meus produtos
    </Link>
  )

  if (editando && carregamento.loading) return <LoadingState label="Carregando produto…" />
  if (editando && carregamento.error) return <ErrorState message={carregamento.error} onRetry={carregamento.reload} />
  if (editando && (!original || original.vendedor_id !== profile?.id || original.excluido_em))
    return (
      <>
        {voltar}
        <EmptyState title="Produto não encontrado" description="Ele pode ter sido excluído ou pertencer a outro vendedor." />
      </>
    )

  const fotoExibida = preview ?? (removerFotoAtual ? null : original?.foto_url ?? null)

  return (
    <>
      {voltar}
      <PageHeader title={titulo} />
      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">Foto</span>
          <button
            type="button"
            onClick={() => inputFoto.current?.click()}
            className={`group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-white dark:bg-slate-900 ${
              erros.foto ? 'border-red-400' : 'border-slate-300 hover:border-brand-500 dark:border-slate-700'
            }`}
            aria-label={fotoExibida ? 'Trocar foto' : 'Adicionar foto'}
          >
            {fotoExibida ? (
              <img src={fotoExibida} alt="Pré-visualização da foto" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <ImagePlus className="h-10 w-10" aria-hidden />
                Toque para adicionar uma foto
                <span className="text-xs">JPG, PNG ou WebP</span>
              </span>
            )}
          </button>
          <input
            ref={inputFoto}
            type="file"
            accept={TIPOS_FOTO.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              escolherFoto(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {erros.foto && <p className="text-sm text-red-600 dark:text-red-400">{erros.foto}</p>}
          {fotoExibida && (
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => inputFoto.current?.click()}>
                Trocar foto
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setArquivo(null)
                  setRemoverFotoAtual(true)
                }}
              >
                <Trash className="h-4 w-4" aria-hidden /> Remover
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {erro && <Alert>{erro}</Alert>}
          <Input label="Nome" value={form.nome} onChange={(e) => set('nome', e.target.value)} error={erros.nome} maxLength={120} />
          <Textarea
            label="Descrição"
            rows={4}
            value={form.descricao}
            onChange={(e) => set('descricao', e.target.value)}
            error={erros.descricao}
            hint="Opcional. Detalhes como composição, largura, cor…"
          />
          <Select
            label="Unidade de medida"
            value={form.unidade}
            onChange={(e) => set('unidade', e.target.value as Unidade | '')}
            error={erros.unidade}
            hint="Como o produto é vendido. Preço e estoque usam esta unidade."
          >
            <option value="">Escolha a unidade</option>
            {UNIDADES.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.label}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={form.unidade ? `Preço por ${siglaUnidade(form.unidade)} (R$)` : 'Preço (R$)'}
              inputMode="decimal"
              placeholder="0,00"
              value={form.preco}
              onChange={(e) => set('preco', e.target.value.replace(/[^\d.,]/g, ''))}
              error={erros.preco}
            />
            <Input
              label={form.unidade ? `Estoque (${siglaUnidade(form.unidade)})` : 'Estoque'}
              inputMode="numeric"
              value={form.estoque}
              onChange={(e) => set('estoque', e.target.value.replace(/\D/g, ''))}
              error={erros.estoque}
            />
          </div>
          <Input
            label={form.unidade ? `Quantidade mínima por pedido (${siglaUnidade(form.unidade)})` : 'Quantidade mínima por pedido'}
            inputMode="numeric"
            placeholder="Sem mínimo"
            value={form.minimo}
            onChange={(e) => set('minimo', e.target.value.replace(/\D/g, ''))}
            error={erros.minimo}
            hint="Opcional. Deixe em branco para o cliente comprar qualquer quantidade."
          />
          <CoresEditor cores={form.cores} onChange={(c) => set('cores', c)} />
          <Input
            label="Categoria"
            list="categorias"
            value={form.categoria}
            onChange={(e) => set('categoria', e.target.value)}
            error={erros.categoria}
            maxLength={60}
          />
          <datalist id="categorias">
            {CATEGORIAS_SUGERIDAS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <span>
              <span className="block text-sm font-medium">Produto ativo</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Produtos inativos não aparecem na vitrine dos compradores.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={form.ativo}
              onChange={(e) => set('ativo', e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 dark:bg-slate-600"
            />
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Link to="/produtos" className={buttonClass('secondary')}>
              Cancelar
            </Link>
            <Button type="submit" loading={salvando}>
              {editando ? 'Salvar alterações' : 'Cadastrar produto'}
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}
