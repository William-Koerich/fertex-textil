import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy, Download, MessageCircle, Share2, X } from 'lucide-react'
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
  const toast = useToast()
  const [copiado, setCopiado] = useState<string | null>(null)
  const [baixando, setBaixando] = useState(false)
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

  /** Imagem vertical (1080×1920) para postar nos Stories do Instagram */
  async function imagemStories() {
    setBaixando(true)
    try {
      const r = await fetch(`/api/og?${card}&formato=story`)
      if (!r.ok || !r.headers.get('content-type')?.startsWith('image/')) throw new Error()
      const arquivo = new File([await r.blob()], `${nomeArquivo}.png`, { type: 'image/png' })
      // No celular abre a folha de compartilhar (escolha Instagram > Stories); no computador, baixa a imagem
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], text: comOrigem(url, 'instagram') }).catch(() => {})
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(arquivo)
        a.download = arquivo.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      }
      await navigator.clipboard?.writeText(comOrigem(url, 'instagram')).catch(() => {})
      toast('Imagem pronta! O link também foi copiado: use o adesivo de link nos Stories.')
    } catch {
      toast('A imagem para Stories fica disponível depois que o app for publicado na Vercel.', 'erro')
    } finally {
      setBaixando(false)
    }
  }

  async function maisOpcoes() {
    try {
      await navigator.share({ title: titulo, text: texto.replace(/\u00a0/g, ' '), url: comOrigem(url, 'outro') })
    } catch {
      /* cancelado */
    }
  }

  const linkFacebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(comOrigem(url, 'facebook'))}`
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
          <Opcao href={linkWhatsapp} cor="bg-[#1f8a4c]" icone={<MessageCircle className="h-5 w-5" />} titulo="WhatsApp" descricao="Enviar para contatos ou grupos" />
          <Opcao href={linkFacebook} cor="bg-[#1877f2]" icone={<IconeFacebook className="h-5 w-5" />} titulo="Facebook" descricao="Publicar no seu perfil ou página" />
          <Opcao
            onClick={imagemStories}
            cor="bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]"
            icone={baixando ? <Download className="h-5 w-5 animate-bounce" /> : <IconeInstagram className="h-5 w-5" />}
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
