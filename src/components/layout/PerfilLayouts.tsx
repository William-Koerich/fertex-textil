import { ClipboardList, LayoutDashboard, LogOut, Package, Receipt, ShoppingCart, Store } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { IconButton } from '@/components/ui/Button'
import { AppLayout } from './AppLayout'
import type { NavItem } from './AppLayout'

function SidebarUser() {
  const { profile, signOut } = useAuth()
  return (
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
  )
}

function HeaderActions() {
  const { signOut } = useAuth()
  return (
    <IconButton onClick={signOut} aria-label="Sair" title="Sair">
      <LogOut className="h-5 w-5" />
    </IconButton>
  )
}

export function VendedorLayout() {
  const items: NavItem[] = [
    { to: '/painel', label: 'Painel', icon: LayoutDashboard },
    { to: '/produtos', label: 'Produtos', icon: Package },
    { to: '/vendas', label: 'Vendas', icon: Receipt },
  ]
  return <AppLayout items={items} headerActions={<HeaderActions />} sidebarFooter={<SidebarUser />} />
}

export function CompradorLayout() {
  const items: NavItem[] = [
    { to: '/loja', label: 'Loja', icon: Store },
    { to: '/carrinho', label: 'Carrinho', icon: ShoppingCart },
    { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  ]
  return <AppLayout items={items} headerActions={<HeaderActions />} sidebarFooter={<SidebarUser />} />
}
