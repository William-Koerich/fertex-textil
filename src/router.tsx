import { createBrowserRouter, Outlet } from 'react-router'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { HomeRedirect, PublicOnly, RequireAuth } from '@/components/ProtectedRoute'
import { CompradorLayout, VendedorLayout } from '@/components/layout/PerfilLayouts'
import LoginPage from '@/features/auth/LoginPage'
import SignupPage from '@/features/auth/SignupPage'
import NotFoundPage from '@/pages/NotFoundPage'
import RouteErrorPage from '@/pages/RouteErrorPage'
import { LoadingState } from '@/components/ui/Spinner'
import { OfflineBanner } from '@/components/pwa/OfflineBanner'
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt'
import ProdutosPage from '@/features/vendedor/ProdutosPage'
import ProdutoFormPage from '@/features/vendedor/ProdutoFormPage'
import VitrinePage from '@/features/comprador/VitrinePage'
import ProdutoDetalhePage from '@/features/comprador/ProdutoDetalhePage'
import CarrinhoPage from '@/features/comprador/CarrinhoPage'
import PedidosPage from '@/features/comprador/PedidosPage'
import VendasPage from '@/features/vendedor/VendasPage'

function Root() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <OfflineBanner />
          <Outlet />
          <UpdatePrompt />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteErrorPage />,
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
          {
            path: 'painel',
            // Recharts é pesado: só é baixado quando o vendedor abre o painel
            lazy: () => import('@/features/vendedor/DashboardPage').then((m) => ({ Component: m.default })),
            hydrateFallbackElement: <LoadingState />,
          },
          { path: 'produtos', element: <ProdutosPage /> },
          { path: 'produtos/novo', element: <ProdutoFormPage /> },
          { path: 'produtos/:id/editar', element: <ProdutoFormPage /> },
          { path: 'vendas', element: <VendasPage /> },
        ],
      },
      {
        element: (
          <RequireAuth perfil="comprador">
            <CompradorLayout />
          </RequireAuth>
        ),
        children: [
          { path: 'loja', element: <VitrinePage /> },
          { path: 'loja/:id', element: <ProdutoDetalhePage /> },
          { path: 'carrinho', element: <CarrinhoPage /> },
          { path: 'pedidos', element: <PedidosPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
