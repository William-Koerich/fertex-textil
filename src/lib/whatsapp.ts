import { formatarMoeda } from './format'
import { formatarPrecoPor, formatarQuantidade } from './unidades'
import type { Unidade } from './unidades'

/**
 * Normaliza o que o usuário digitou para só dígitos com DDI.
 * "(47) 99999-8888" → "5547999998888". Números com 10/11 dígitos recebem o DDI 55 (Brasil).
 * Retorna null se não parecer um telefone válido.
 */
export function normalizarWhatsapp(entrada: string): string | null {
  let d = entrada.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10 || d.length === 11) d = '55' + d
  return /^\d{12,15}$/.test(d) ? d : null
}

/** "5547999998888" → "+55 (47) 99999-8888" */
export function formatarWhatsapp(d: string | null | undefined): string {
  if (!d) return ''
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${d}`
}

export const linkWhatsapp = (numero: string, texto: string) => `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`

export interface PedidoMensagem {
  pedido_id: string
  vendedor_nome: string
  total: number
  itens: { nome: string; quantidade: number; preco_unitario: number; unidade?: Unidade; cor?: string | null }[]
  observacao?: string | null
}

export const codigoPedido = (id: string) => id.slice(0, 8).toUpperCase()

/** Texto do pedido enviado ao vendedor pelo WhatsApp. */
export function mensagemPedido(p: PedidoMensagem, comprador: string): string {
  const linhas = [
    `Olá, ${p.vendedor_nome.split(' ')[0]}! Quero fazer um pedido pelo Fertex Vendas.`,
    '',
    `*Pedido #${codigoPedido(p.pedido_id)}*`,
    ...p.itens.map(
      (i) =>
        `• ${formatarQuantidade(i.quantidade, i.unidade)} de ${i.nome}${i.cor ? ` - cor ${i.cor}` : ''} (${formatarPrecoPor(i.preco_unitario, i.unidade)}) = ${formatarMoeda(i.quantidade * i.preco_unitario)}`,
    ),
    '',
    `*Total: ${formatarMoeda(p.total)}*`,
    `Nome: ${comprador}`,
  ]
  if (p.observacao) linhas.push(`Observação: ${p.observacao}`)
  linhas.push('', 'Podemos combinar pagamento e entrega?')
  // O Intl usa espaço não separável em "R$ 10,00"; troca por espaço normal para o WhatsApp
  return linhas.join('\n').replace(/ /g, ' ')
}
