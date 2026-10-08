import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
}

interface Props {
  items: NavItem[]
  /** Conteúdo extra no topo (ex.: usuário, tema, sair) */
  headerActions?: ReactNode
  sidebarFooter?: ReactNode
}

function Logo() {
  return (
    <div className="flex items-center gap-2 font-semibold">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span>
        Fertex <span className="text-brand-600 dark:text-brand-400">Vendas</span>
      </span>
    </div>
  )
}

function Badge({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span className="ml-auto min-w-5 rounded-full bg-brand-600 px-1.5 text-center text-xs leading-5 font-semibold text-white">
      {n > 99 ? '99+' : n}
    </span>
  )
}

export function AppLayout({ items, headerActions, sidebarFooter }: Props) {
  return (
    <div className="min-h-dvh md:flex">
      {/* Lateral (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="px-2 pb-6">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Navegação principal">
          {items.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
              <Badge n={badge} />
            </NavLink>
          ))}
        </nav>
        {sidebarFooter}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topo (celular) */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <Logo />
          <div className="flex items-center gap-1">{headerActions}</div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-8">
          <Outlet />
        </main>

        {/* Navegação inferior (celular) */}
        <nav
          className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:hidden dark:border-slate-800 dark:bg-slate-900"
          aria-label="Navegação principal"
        >
          <ul className="flex">
            {items.map(({ to, label, icon: Icon, badge }) => (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                      isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
                    }`
                  }
                >
                  <Icon className="h-6 w-6" aria-hidden />
                  {label}
                  {!!badge && (
                    <span className="absolute top-1 left-1/2 ml-2 min-w-4 rounded-full bg-brand-600 px-1 text-center text-[10px] leading-4 text-white">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
