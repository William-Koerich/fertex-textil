import { createBrowserRouter } from 'react-router'
import { LayoutDashboard, Package, Store } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import NotFoundPage from '@/pages/NotFoundPage'

function Placeholder({ title }: { title: string }) {
  return <PageHeader title={title} subtitle="Em construção" />
}

export const router = createBrowserRouter([
  {
    element: (
      <AppLayout
        items={[
          { to: '/', label: 'Início', icon: LayoutDashboard },
          { to: '/produtos', label: 'Produtos', icon: Package },
          { to: '/loja', label: 'Loja', icon: Store },
        ]}
      />
    ),
    children: [
      { index: true, element: <Placeholder title="Início" /> },
      { path: 'produtos', element: <Placeholder title="Produtos" /> },
      { path: 'loja', element: <Placeholder title="Loja" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
