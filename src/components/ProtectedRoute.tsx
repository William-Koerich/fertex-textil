import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Perfil } from '@db/schema'
import { rotaInicial, useAuth } from '@/contexts/AuthContext'
import { FullScreenLoading } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { Button } from '@/components/ui/Button'

function PerfilIndisponivel() {
  const { profileError, signOut } = useAuth()
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <ErrorState message={profileError ?? 'Perfil não encontrado.'} onRetry={() => window.location.reload()} />
      <Button variant="ghost" onClick={signOut}>
        Sair e entrar com outra conta
      </Button>
    </div>
  )
}

/** Só renderiza os filhos se o usuário estiver logado e tiver o perfil exigido. */
export function RequireAuth({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoading />
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />
  if (!profile) return <PerfilIndisponivel />
  if (profile.perfil !== perfil) return <Navigate to={rotaInicial(profile.perfil)} replace />
  return <>{children}</>
}

/** Telas de login/cadastro: quem já está logado vai para a tela inicial do seu perfil. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoading />
  if (session && profile) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/' ? from : rotaInicial(profile.perfil)} replace />
  }
  return <>{children}</>
}

/** Rota "/": redireciona conforme o perfil. */
export function HomeRedirect() {
  const { session, profile, loading } = useAuth()
  if (loading) return <FullScreenLoading />
  if (!session) return <Navigate to="/entrar" replace />
  if (!profile) return <PerfilIndisponivel />
  return <Navigate to={rotaInicial(profile.perfil)} replace />
}
