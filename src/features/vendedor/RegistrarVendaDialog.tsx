import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { mensagemErro } from '@/lib/errors'
import { formatarMoeda, formatarNumero, parseMoeda } from '@/lib/format'
import { registrarVenda } from '@/lib/pedidos'
import type { Produto } from '@/lib/produtos'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Alert } from '@/components/ui/States'
import { QuantityStepper } from '@/components/ui/QuantityStepper'

interface Props {
  open: boolean
  /** Produto já escolhido (vindo da lista de produtos). Se ausente, mostra um seletor com `produtos`. */
  produto?: Produto | null
  produtos?: Produto[]
  onClose: () => void
  /** Chamado após registrar, com o produto e a quantidade vendida */
  onRegistrada: (produto: Produto, quantidade: number) => void
}

const precoTexto = (v: number) => v.toFixed(2).replace('.', ',')

/** Registra uma venda feita fora do app (balcão, WhatsApp…). Baixa o estoque e entra nas vendas/painel. */
export function RegistrarVendaDialog({ open, produto, produtos = [], onClose, onRegistrada }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const disponiveis = produtos.filter((p) => p.estoque > 0)
  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [preco, setPreco] = useState('')
  const [cliente, setCliente] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [erroPreco, setErroPreco] = useState<string>()
  const [enviando, setEnviando] = useState(false)

  const selecionado = produto ?? disponiveis.find((p) => p.id === produtoId) ?? null

  // Reinicia o formulário a cada abertura
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open) {
      setProdutoId(produto?.id ?? '')
      setQuantidade(1)
      setPreco(produto ? precoTexto(produto.preco) : '')
      setCliente('')
      setErro(null)
      setErroPreco(undefined)
      if (!d.open) d.showModal()
    } else if (d.open) d.close()
  }, [open, produto])

  const precoNum = parseMoeda(preco)
  const total = Number.isNaN(precoNum) ? 0 : precoNum * quantidade

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selecionado) return setErro('Escolha o produto vendido.')
    if (Number.isNaN(precoNum) || precoNum < 0) return setErroPreco('Preço inválido. Use o formato 49,90.')
    setErro(null)
    setEnviando(true)
    try {
      await registrarVenda({ produtoId: selecionado.id, quantidade, clienteNome: cliente, precoUnitario: precoNum })
      onRegistrada(selecionado, quantidade)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível registrar a venda. Tente novamente.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        if (!enviando) onClose()
      }}
      onClick={(e) => e.target === ref.current && !enviando && onClose()}
      aria-labelledby="titulo-registrar-venda"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50 dark:bg-slate-900 dark:text-slate-100"
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-6">
        <div>
          <h2 id="titulo-registrar-venda" className="text-lg font-semibold">
            Registrar venda
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Para vendas feitas fora do app (balcão, WhatsApp…). O estoque é atualizado na hora.
          </p>
        </div>

        {erro && <Alert>{erro}</Alert>}

        {produto ? (
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
            <p className="font-medium">{produto.nome}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{formatarNumero(produto.estoque)} em estoque</p>
          </div>
        ) : (
          <Select
            label="Produto"
            value={produtoId}
            onChange={(e) => {
              const p = disponiveis.find((x) => x.id === e.target.value)
              setProdutoId(e.target.value)
              setQuantidade(1)
              setPreco(p ? precoTexto(p.preco) : '')
            }}
            hint={disponiveis.length ? undefined : 'Nenhum produto com estoque disponível.'}
          >
            <option value="">Escolha o produto</option>
            {disponiveis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({formatarNumero(p.estoque)} em estoque)
              </option>
            ))}
          </Select>
        )}

        {selecionado && (
          <>
            <div className="flex items-end gap-4">
              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Quantidade</span>
                <QuantityStepper value={quantidade} max={selecionado.estoque} onChange={setQuantidade} label="Quantidade vendida" />
              </div>
              <div className="flex-1">
                <Input
                  label="Preço unitário (R$)"
                  inputMode="decimal"
                  value={preco}
                  onChange={(e) => {
                    setPreco(e.target.value.replace(/[^\d.,]/g, ''))
                    setErroPreco(undefined)
                  }}
                  error={erroPreco}
                />
              </div>
            </div>
            {quantidade === selecionado.estoque && (
              <p className="text-sm text-amber-700 dark:text-amber-400">Esta venda zera o estoque: o produto ficará esgotado.</p>
            )}
            <Input
              label="Cliente (opcional)"
              placeholder="Nome de quem comprou"
              autoComplete="off"
              maxLength={120}
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
            />
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">Total</span>
              <span className="text-lg font-bold">{formatarMoeda(total)}</span>
            </div>
          </>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando} disabled={!selecionado}>
            Registrar venda
          </Button>
        </div>
      </form>
    </dialog>
  )
}
