import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Perfil, Profile } from '@db/schema'
import { supabase } from '@/lib/supabase'

interface SignUpInput {
  nome: string
  email: string
  senha: string
  perfil: Perfil
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  /** true enquanto a sessão ou o perfil ainda estão sendo carregados */
  loading: boolean
  profileError: string | null
  signIn: (email: string, senha: string) => Promise<void>
  /** Retorna true se a conta já está logada; false se precisa confirmar o e-mail */
  signUp: (input: SignUpInput) => Promise<boolean>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const rotaInicial = (perfil: Perfil) => (perfil === 'vendedor' ? '/painel' : '/loja')

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    // Não chamar o Supabase dentro deste callback (pode travar o cliente); só atualiza o estado.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setSessionLoaded(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileUserId(null)
      setProfileError(null)
      return
    }
    let ativo = true
    supabase
      .from('fertex_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return
        setProfile((data as Profile | null) ?? null)
        setProfileError(
          error
            ? 'Não foi possível carregar seu perfil. Verifique sua conexão.'
            : data
              ? null
              : 'Esta conta não possui perfil no Fertex Vendas.',
        )
        setProfileUserId(userId)
      })
    return () => {
      ativo = false
    }
  }, [userId])

  const signIn = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    if (error) throw error
  }, [])

  const signUp = useCallback(async ({ nome, email, senha, perfil }: SignUpInput) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim(), fertex_perfil: perfil } },
    })
    if (error) throw error
    // Com "confirm email" ativo, o Supabase retorna um usuário sem identidades quando o e-mail já existe
    if (data.user && data.user.identities?.length === 0) throw { code: 'user_already_exists' }
    return !!data.session
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const loading = !sessionLoaded || (!!userId && profileUserId !== userId)

  const value = useMemo(
    () => ({ session, profile, loading, profileError, signIn, signUp, signOut }),
    [session, profile, loading, profileError, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
