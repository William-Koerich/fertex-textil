import { MessageCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useContatoAtual } from '@/contexts/ContatoContext'
import { useVendedoresPublicos } from '@/lib/vendedores'
import type { VendedorPublico } from '@/lib/vendedores'
import { formatarWhatsapp, linkWhatsapp } from '@/lib/whatsapp'

/** Vendedor do contato: o da página; na loja geral, o único vendedor (se houver só um com WhatsApp). */
export function resolverVendedor(lista: VendedorPublico[], vendedorId?: string | null) {
  const comWhatsapp = lista.filter((v) => v.whatsapp)
  if (vendedorId) return comWhatsapp.find((v) => v.id === vendedorId) ?? null
  return comWhatsapp.length === 1 ? comWhatsapp[0] : null
}

/**
 * Botão flutuante do WhatsApp na loja: o cliente fala com o vendedor sem precisar criar conta.
 * Na página de um produto, a mensagem já vai com o nome, o preço e o link do produto.
 */
export function WhatsappFlutuante() {
  const { profile } = useAuth()
  const { vendedorId, produto } = useContatoAtual()
  const vendedor = resolverVendedor(useVendedoresPublicos(), vendedorId)
  if (!vendedor?.whatsapp || profile?.perfil === 'vendedor') return null

  const primeiroNome = vendedor.nome.split(' ')[0]
  const texto = produto
    ? `Olá, ${primeiroNome}! Tenho interesse no produto *${produto.nome}* (${produto.preco}).\n${window.location.origin}/loja/${produto.id}\nPode me passar mais informações?`
    : `Olá, ${primeiroNome}! Vi sua loja no Fertex Vendas e gostaria de mais informações.`

  return (
    <a
      href={linkWhatsapp(vendedor.whatsapp, texto.replace(/ /g, ' '))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Conversar com ${vendedor.nome} no WhatsApp ${formatarWhatsapp(vendedor.whatsapp)}`}
      title={`WhatsApp ${formatarWhatsapp(vendedor.whatsapp)}`}
      className="group fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 rounded-full bg-[#1f8a4c] p-3.5 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-[#18733f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f8a4c] md:right-6 md:bottom-6 md:px-5"
    >
      <MessageCircle className="h-7 w-7 shrink-0" aria-hidden />
      <span className="hidden text-sm leading-tight font-semibold md:block">
        Fale no WhatsApp
        <span className="block text-xs font-normal opacity-90">{formatarWhatsapp(vendedor.whatsapp).replace('+55 ', '')}</span>
      </span>
    </a>
  )
}
