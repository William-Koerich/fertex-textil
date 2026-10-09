import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
  ClipboardList,
  Inbox,
  LayoutDashboard,
  LogIn,
  LogOut,
  Package,
  Receipt,
  ShoppingCart,
  Store,
  UserRound,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'
import { contarPedidosPendentes } from '@/lib/pedidos'
import { buttonClass, IconButton } from '@/components/ui/Button'
import { InstallButton } from '@/components/pwa/InstallButton'
import { ThemeSegmented, ThemeToggleButton } from '@/components/ThemeToggle'
import { FullScreenLoading } from '@/components/ui/Spinner'
import { AppLayout } from './AppLayout'
import type { NavItem } from './AppLayout'

/** Disparado pelas telas que mudam pedidos, para atualizar o contador do menu. */
export const EVENTO_PEDIDOS = 'fertex:pedidos-atualizados'

function SidebarUser() {
  const { profile, signOut } = useAuth()
  return (
    <>
      <InstallButton />
      <ThemeSegmented />
      <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
          {profile?.nome.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{profile?.nome}</p>
          <p className="text-xs text-slate-500 capitalize dark:text-slate-400">{profile?.perfil}</p>
        </div>
        <IconButton onClick={signOut} aria-label="Sair" title="Sair">
          <LogOut className="h-5 w-5" />
        </IconButton>
      </div>
    </>
  )
}

function SidebarVisitante() {
  const { pathname, search } = useLocation()
  const state = { from: pathname + search }
  return (
    <>
      <InstallButton />
      <ThemeSegmented />
      <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <Link to="/entrar" state={state} className={buttonClass('primary')}>
          Entrar
        </Link>
        <Link to="/cadastro" state={state} className={buttonClass('secondary')}>
          Criar conta
        </Link>
      </div>
    </>
  )
}

function HeaderActions() {
  const { signOut } = useAuth()
  return (
    <>
      <InstallButton variant="icon" />
      <ThemeToggleButton />
      <IconButton onClick={signOut} aria-label="Sair" title="Sair">
        <LogOut className="h-5 w-5" />
      </IconButton>
    </>
  )
}

function HeaderVisitante() {
  const { pathname, search } = useLocation()
  return (
    <>
      <ThemeToggleButton />
      <Link to="/entrar" state={{ from: pathname + search }} className={buttonClass('primary', 'ml-1 px-3 py-1.5')}>
        <LogIn className="h-4 w-4" aria-hidden /> Entrar
      </Link>
    </>
  )
}

/** Quantidade de pedidos pelo WhatsApp aguardando o vendedor marcar como vendido. */
function usePedidosPendentes() {
  const [n, setN] = useState(0)
  const atualizar = useCallback(() => {
    contarPedidosPendentes()
      .then(setN)
      .catch(() => {})
  }, [])
  useEffect(() => {
    atualizar()
    const id = setInterval(atualizar, 60_000)
    window.addEventListener(EVENTO_PEDIDOS, atualizar)
    window.addEventListener('focus', atualizar)
    return () => {
      clearInterval(id)
      window.removeEventListener(EVENTO_PEDIDOS, atualizar)
      window.removeEventListener('focus', atualizar)
    }
  }, [atualizar])
  return n
}

export function VendedorLayout() {
  const pendentes = usePedidosPendentes()
  const items: NavItem[] = [
    { to: '/painel', label: 'Painel', icon: LayoutDashboard },
    { to: '/produtos', label: 'Produtos', icon: Package },
    { to: '/pedidos-recebidos', label: 'Pedidos', icon: Inbox, badge: pendentes },
    { to: '/vendas', label: 'Vendas', icon: Receipt },
    { to: '/perfil', label: 'Perfil', icon: UserRound },
  ]
  return <AppLayout items={items} headerActions={<HeaderActions />} sidebarFooter={<SidebarUser />} />
}

/** Loja pública: visitante, comprador ou vendedor vendo a própria vitrine. */
export function LojaLayout() {
  const { session, profile, loading } = useAuth()
  const { totalItens } = useCart()
  if (loading) return <FullScreenLoading />
  if (profile?.perfil === 'vendedor') return <VendedorLayout />

  const items: NavItem[] = [
    { to: '/loja', label: 'Loja', icon: Store },
    { to: '/carrinho', label: 'Carrinho', icon: ShoppingCart, badge: totalItens },
  ]
  if (session && profile) items.push({ to: '/pedidos', label: 'Pedidos', icon: ClipboardList })

  return session && profile ? (
    <AppLayout items={items} headerActions={<HeaderActions />} sidebarFooter={<SidebarUser />} />
  ) : (
    <AppLayout items={items} headerActions={<HeaderVisitante />} sidebarFooter={<SidebarVisitante />} />
  )
}
