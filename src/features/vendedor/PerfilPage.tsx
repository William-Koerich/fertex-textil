import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { Copy, ExternalLink, Share2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { mensagemErro } from '@/lib/errors'
import { linkDaLoja } from '@/lib/vendedores'
import { formatarWhatsapp, normalizarWhatsapp } from '@/lib/whatsapp'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, buttonClass } from '@/components/ui/Button'
import { Input, inputClass } from '@/components/ui/Field'
import { Alert } from '@/components/ui/States'

const card = 'rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900'

export default function PerfilPage() {
  const { profile, atualizarPerfil } = useAuth()
  const toast = useToast()
  const [nome, setNome] = useState(profile?.nome ?? '')
  const [whatsapp, setWhatsapp] = useState(formatarWhatsapp(profile?.whatsapp))
  const [erros, setErros] = useState<{ nome?: string; whatsapp?: string }>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const link = profile ? linkDaLoja(profile.id) : ''

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const novos: typeof erros = {}
    if (nome.trim().length < 2) novos.nome = 'Informe seu nome (mínimo 2 caracteres).'
    const numero = whatsapp.trim() ? normalizarWhatsapp(whatsapp) : null
    if (whatsapp.trim() && !numero) novos.whatsapp = 'Número inválido. Use DDD + número, ex.: (47) 99999-8888.'
    setErros(novos)
    if (Object.keys(novos).length) return
    setErro(null)
    setSalvando(true)
    try {
      await atualizarPerfil({ nome: nome.trim(), whatsapp: numero })
      setWhatsapp(formatarWhatsapp(numero))
      toast('Perfil atualizado.')
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copiado! Cole no WhatsApp, Instagram…')
    } catch {
      toast('Não foi possível copiar. Selecione o link e copie manualmente.', 'erro')
    }
  }

  async function compartilhar() {
    try {
      await navigator.share({ title: `Loja de ${profile?.nome}`, text: 'Veja meus produtos e faça seu pedido:', url: link })
    } catch {
      /* usuário cancelou */
    }
  }

  return (
    <>
      <PageHeader title="Perfil" subtitle="Seus dados e o link da sua loja." />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <form onSubmit={salvar} noValidate className={`${card} space-y-4`}>
          <h2 className="font-semibold">Dados para receber pedidos</h2>
          {erro && <Alert>{erro}</Alert>}
          {!profile?.whatsapp && (
            <Alert kind="info">Cadastre seu WhatsApp: é para ele que os clientes enviam os pedidos.</Alert>
          )}
          <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} error={erros.nome} autoComplete="name" />
          <Input
            label="WhatsApp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(47) 99999-8888"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            error={erros.whatsapp}
            hint="Com DDD. Números de fora do Brasil: comece com o código do país."
          />
          <div className="flex justify-end">
            <Button type="submit" loading={salvando}>
              Salvar
            </Button>
          </div>
        </form>

        <section className={`${card} space-y-4`} aria-labelledby="titulo-link">
          <div>
            <h2 id="titulo-link" className="font-semibold">
              Link da sua loja
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Envie para seus clientes. Eles veem só os seus produtos, sem precisar de login, e fazem o pedido pelo WhatsApp.
            </p>
          </div>
          <input readOnly value={link} aria-label="Link da sua loja" onFocus={(e) => e.target.select()} className={`${inputClass()} text-sm`} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={copiar}>
              <Copy className="h-4 w-4" aria-hidden /> Copiar link
            </Button>
            {'share' in navigator && (
              <Button variant="secondary" onClick={compartilhar}>
                <Share2 className="h-4 w-4" aria-hidden /> Compartilhar
              </Button>
            )}
            <Link to={`/loja?vendedor=${profile?.id}`} className={buttonClass('ghost')}>
              <ExternalLink className="h-4 w-4" aria-hidden /> Ver minha loja
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
