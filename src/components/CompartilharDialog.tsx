import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, CircleDashed, Copy, Download, MessageCircle, Share2, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { IconeFacebook, IconeInstagram } from './IconesRedes'

interface Props {
  open: boolean
  onClose: () => void
  /** Ex.: "Compartilhar minha loja" */
  titulo: string
  /** Link sem o parâmetro de origem (ele é adicionado por rede, para as estatísticas de visitas) */
  url: string
  /** Texto que acompanha o link no WhatsApp / compartilhamento do celular */
  texto: string
  /** Parâmetros da imagem do card: "produto=<id>" ou "vendedor=<id>" */
  card: string
  /** Nome do arquivo da imagem para Stories */
  nomeArquivo: string
}

const comOrigem = (url: string, origem: string) => {
  const u = new URL(url)
  u.searchParams.set('origem', origem)
  return u.toString()
}

function Opcao({ icone, titulo, descricao, onClick, href, cor }: { icone: ReactNode; titulo: string; descricao: string; onClick?: () => void; href?: string; cor: string }) {
  const conteudo = (
    <>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${cor}`}>{icone}</span>
      <span className="min-w-0 text-left">
        <span className="block font-semibold">{titulo}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{descricao}</span>
      </span>
    </>
  )
  const cls = 'flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick}>
      {conteudo}
    </a>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {conteudo}
    </button>
  )
}

/** Compartilhar loja/produto: WhatsApp, Facebook, Instagram (imagem para Stories + link) e copiar link. */
export function CompartilharDialog({ open, onClose, titulo, url, texto, card, nomeArquivo }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const celular = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const toast = useToast()
  const [copiado, setCopiado] = useState<string | null>(null)
  const [baixando, setBaixando] = useState<'whatsapp' | 'instagram' | null>(null)
  const [previaOk, setPreviaOk] = useState(true)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setCopiado(null)
      setPreviaOk(true)
      d.showModal()
    }
    if (!open && d.open) d.close()
  }, [open])

  async function copiar(link: string, rotulo: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(rotulo)
      toast(rotulo === 'instagram' ? 'Link copiado! Cole no link da bio ou no adesivo de link dos Stories.' : 'Link copiado!')
    } catch {
      toast('Não foi possível copiar. Selecione o link e copie manualmente.', 'erro')
    }
  }

  // A imagem vertical é baixada assim que o diálogo abre: no celular o menu de compartilhar só pode ser
  // aberto logo após o toque, então ela precisa estar pronta antes (senão o iPhone bloqueia o menu)
  const imagemVertical = useRef<Promise<File | null> | null>(null)
  useEffect(() => {
    if (!open) return
    imagemVertical.current = fetch(`/api/og?${card}&formato=story`)
      .then(async (r) => {
        if (!r.ok || !r.headers.get('content-type')?.startsWith('image/')) return null
        return new File([await r.blob()], `${nomeArquivo}.png`, { type: 'image/png' })
      })
      .catch(() => null)
  }, [open, card, nomeArquivo])

  /**
   * Imagem vertical (1080×1920) para Status do WhatsApp ou Stories do Instagram.
   * Nesses lugares link não vira prévia: o que aparece é a imagem, com o link na legenda (WhatsApp)
   * ou no adesivo de link (Instagram). O link é copiado antes, para colar caso a legenda não venha junto.
   */
  async function imagemVerticalPara(rede: 'whatsapp' | 'instagram') {
    const link = comOrigem(url, rede)
    const legenda = rede === 'whatsapp' ? `${texto.replace(/\u00a0/g, ' ')}\n${link}` : link
    navigator.clipboard?.writeText(rede === 'whatsapp' ? legenda : link).catch(() => {})
    setBaixando(rede)
    try {
      const arquivo = await (imagemVertical.current ?? Promise.resolve(null))
      if (!arquivo) throw new Error('sem imagem')
      if (celular && navigator.canShare?.({ files: [arquivo] })) {
        try {
          await navigator.share({ files: [arquivo], text: legenda })
        } catch (e) {
          if ((e as DOMException)?.name === 'AbortError') return
          baixar(arquivo)
        }
      } else {
        baixar(arquivo)
      }
      onClose() // fecha o diálogo para a instrução (toast) ficar visível
      toast(
        rede === 'whatsapp'
          ? 'Escolha WhatsApp > Meu status. O texto com o link já foi copiado: se não aparecer na legenda, é só colar.'
          : 'Escolha Instagram > Stories. O link foi copiado: use o adesivo "Link" nos Stories.',
      )
    } catch {
      toast('Não foi possível gerar a imagem agora. Verifique a internet e tente de novo.', 'erro')
    } finally {
      setBaixando(null)
    }
  }

  function baixar(arquivo: File) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(arquivo)
    a.download = arquivo.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  async function maisOpcoes() {
    try {
      await navigator.share({ title: titulo, text: texto.replace(/\u00a0/g, ' '), url: comOrigem(url, 'outro') })
    } catch {
      /* cancelado */
    }
  }

  const linkFacebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(comOrigem(url, 'facebook'))}`
  /**
   * No celular, o app do Facebook ignora o link de compartilhamento e só abre o feed. Por isso usamos o
   * menu de compartilhar do aparelho: a pessoa escolhe "Facebook" e o app abre já com o link (e a arte da prévia).
   * No computador, abre a página de compartilhar do Facebook numa janela.
   */
  async function compartilharFacebook() {
    const link = comOrigem(url, 'facebook')
    if (celular && 'share' in navigator) {
      try {
        await navigator.share({ title: titulo, url: link })
        return
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return
      }
    }
    if (!window.open(linkFacebook, 'compartilhar-facebook', 'width=640,height=640')) window.location.href = linkFacebook
  }
  const linkWhatsapp = `https://wa.me/?text=${encodeURIComponent(`${texto.replace(/\u00a0/g, ' ')}\n${comOrigem(url, 'whatsapp')}`)}`

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="titulo-compartilhar"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 id="titulo-compartilhar" className="text-lg font-semibold">
            {titulo}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {previaOk && (
          <figure className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <img src={`/api/og?${card}`} alt="Prévia do link" className="aspect-[1200/630] w-full bg-slate-100 object-cover dark:bg-slate-800" onError={() => setPreviaOk(false)} />
            <figcaption className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">É assim que o link aparece no Facebook, Instagram e WhatsApp.</figcaption>
          </figure>
        )}

        <div className="space-y-2">
          <Opcao href={linkWhatsapp} cor="bg-[#1f8a4c]" icone={<MessageCircle className="h-5 w-5" />} titulo="WhatsApp: conversas" descricao="Enviar para contatos ou grupos (com prévia do link)" />
          <Opcao
            onClick={() => imagemVerticalPara('whatsapp')}
            cor="bg-[#1f8a4c]"
            icone={baixando === 'whatsapp' ? <Download className="h-5 w-5 animate-bounce" /> : <CircleDashed className="h-5 w-5" />}
            titulo="Status do WhatsApp"
            descricao={celular ? 'Imagem vertical com o link na legenda' : 'Baixar a imagem vertical (o link é copiado)'}
          />
          <Opcao
            onClick={compartilharFacebook}
            cor="bg-[#1877f2]"
            icone={<IconeFacebook className="h-5 w-5" />}
            titulo="Facebook"
            descricao={celular ? 'Escolha "Facebook" na lista que vai abrir' : 'Publicar no seu perfil ou página'}
          />
          <Opcao
            onClick={() => imagemVerticalPara('instagram')}
            cor="bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]"
            icone={baixando === 'instagram' ? <Download className="h-5 w-5 animate-bounce" /> : <IconeInstagram className="h-5 w-5" />}
            titulo="Instagram Stories"
            descricao="Imagem vertical pronta + link copiado para o adesivo"
          />
          <Opcao
            onClick={() => copiar(comOrigem(url, 'instagram'), 'instagram')}
            cor="bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]"
            icone={copiado === 'instagram' ? <Check className="h-5 w-5" /> : <IconeInstagram className="h-5 w-5" />}
            titulo="Link para a bio do Instagram"
            descricao="Copiar o link para colocar na bio ou no Direct"
          />
          <Opcao
            onClick={() => copiar(url, 'link')}
            cor="bg-slate-700"
            icone={copiado === 'link' ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            titulo="Copiar link"
            descricao={url.replace(/^https?:\/\//, '')}
          />
          {'share' in navigator && (
            <Opcao onClick={maisOpcoes} cor="bg-brand-600" icone={<Share2 className="h-5 w-5" />} titulo="Mais opções" descricao="Telegram, e-mail, outros apps do celular" />
          )}
        </div>
      </div>
    </dialog>
  )
}
