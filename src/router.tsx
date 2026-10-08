import { createBrowserRouter, Outlet } from 'react-router'
import { AuthProvider } from '@/contexts/AuthContext'
import { HomeRedirect, PublicOnly, RequireAuth } from '@/components/ProtectedRoute'
import { CompradorLayout, VendedorLayout } from '@/components/layout/PerfilLayouts'
import { PageHeader } from '@/components/ui/PageHeader'
import LoginPage from '@/features/auth/LoginPage'
import SignupPage from '@/features/auth/SignupPage'
import NotFoundPage from '@/pages/NotFoundPage'

function Placeholder({ title }: { title: string }) {
  return <PageHeader title={title} subtitle="Em construção" />
}

function Root() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'entrar', element: <PublicOnly><LoginPage /></PublicOnly> },
      { path: 'cadastro', element: <PublicOnly><SignupPage /></PublicOnly> },
      {
        element: (
          <RequireAuth perfil="vendedor">
            <VendedorLayout />
          </RequireAuth>
        ),
        children: [
          { path: 'painel', element: <Placeholder title="Painel" /> },
          { path: 'produtos', element: <Placeholder title="Meus produtos" /> },
          { path: 'vendas', element: <Placeholder title="Produtos vendidos" /> },
        ],
      },
      {
        element: (
          <RequireAuth perfil="comprador">
            <CompradorLayout />
          </RequireAuth>
        ),
        children: [
          { path: 'loja', element: <Placeholder title="Loja" /> },
          { path: 'carrinho', element: <Placeholder title="Carrinho" /> },
          { path: 'pedidos', element: <Placeholder title="Meus pedidos" /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
