import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { ShoppingCart, Store } from 'lucide-react'
import type { Perfil } from '@db/schema'
import { useAuth } from '@/contexts/AuthContext'
import { mensagemErro } from '@/lib/errors'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/States'
import { AuthLayout } from './AuthLayout'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const opcoes: { valor: Perfil; titulo: string; descricao: string; icon: typeof Store }[] = [
  { valor: 'vendedor', titulo: 'Vendedor', descricao: 'Cadastro produtos e acompanho minhas vendas', icon: Store },
  { valor: 'comprador', titulo: 'Comprador', descricao: 'Navego pela loja e faço pedidos', icon: ShoppingCart },
]

type Erros = Partial<Record<'nome' | 'email' | 'senha' | 'confirmacao' | 'perfil', string>>

export default function SignupPage() {
  const { signUp } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmarEmail, setConfirmarEmail] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const novos: Erros = {}
    if (nome.trim().length < 2) novos.nome = 'Informe seu nome (mínimo 2 caracteres).'
    if (!EMAIL_RE.test(email.trim())) novos.email = 'Informe um e-mail válido.'
    if (senha.length < 6) novos.senha = 'A senha deve ter pelo menos 6 caracteres.'
    if (confirmacao !== senha) novos.confirmacao = 'As senhas não conferem.'
    if (!perfil) novos.perfil = 'Escolha como você vai usar o app.'
    setErros(novos)
    if (Object.keys(novos).length || !perfil) return

    setErro(null)
    setEnviando(true)
    try {
      const logado = await signUp({ nome, email, senha, perfil })
      if (!logado) setConfirmarEmail(true)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  if (confirmarEmail) {
    return (
      <AuthLayout title="Confirme seu e-mail" subtitle={`Enviamos um link de confirmação para ${email.trim()}.`}>
        <Alert kind="info">Abra o link do e-mail para ativar sua conta e depois faça login.</Alert>
        <Link
          to="/entrar"
          className="mt-6 block text-center text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          Ir para o login
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Leva menos de um minuto.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {erro && <Alert>{erro}</Alert>}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Eu sou</legend>
          <div className="grid grid-cols-2 gap-3" role="radiogroup">
            {opcoes.map(({ valor, titulo, descricao, icon: Icon }) => {
              const sel = perfil === valor
              return (
                <label
                  key={valor}
                  className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-brand-500 ${
                    sel
                      ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/50'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="perfil"
                    value={valor}
                    checked={sel}
                    onChange={() => setPerfil(valor)}
                    className="sr-only"
                  />
                  <Icon className={`h-6 w-6 ${sel ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} aria-hidden />
                  <span className="font-semibold">{titulo}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{descricao}</span>
                </label>
              )
            })}
          </div>
          {erros.perfil && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{erros.perfil}</p>}
        </fieldset>

        <Input label="Nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} error={erros.nome} />
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
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          error={erros.senha}
          hint="Mínimo de 6 caracteres."
        />
        <Input
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          error={erros.confirmacao}
        />
        <Button type="submit" className="w-full" loading={enviando}>
          Criar conta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}
