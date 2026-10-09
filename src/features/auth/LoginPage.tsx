import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'
import { mensagemErro } from '@/lib/errors'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/States'
import { AuthLayout } from './AuthLayout'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const { signIn } = useAuth()
  const location = useLocation()
  const vindoDaLoja = /^\/(carrinho|loja)/.test((location.state as { from?: string } | null)?.from ?? '')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<{ email?: string; senha?: string }>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const novos: typeof erros = {}
    if (!EMAIL_RE.test(email.trim())) novos.email = 'Informe um e-mail válido.'
    if (!senha) novos.senha = 'Informe sua senha.'
    setErros(novos)
    if (Object.keys(novos).length) return

    setErro(null)
    setEnviando(true)
    try {
      await signIn(email, senha)
      // O redirecionamento acontece em <PublicOnly> quando o perfil carrega
    } catch (err) {
      setErro(mensagemErro(err))
      setEnviando(false)
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle={vindoDaLoja ? 'Entre para enviar seu pedido. Seu carrinho continua salvo.' : 'Acesse sua conta para vender ou comprar.'}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {erro && <Alert>{erro}</Alert>}
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={erros.email}
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          error={erros.senha}
        />
        <Button type="submit" className="w-full" loading={enviando}>
          Entrar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" state={location.state} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  )
}
