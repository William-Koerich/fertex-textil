import { isRouteErrorResponse, useRouteError } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import NotFoundPage from './NotFoundPage'

/** Erro inesperado em qualquer rota (inclui falha ao baixar um trecho do app, ex. sem internet). */
export default function RouteErrorPage() {
  const erro = useRouteError()
  if (isRouteErrorResponse(erro) && erro.status === 404) return <NotFoundPage />
  console.error(erro)
  const offline = !navigator.onLine
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <TriangleAlert className="h-12 w-12 text-amber-500" aria-hidden />
      <h1 className="text-xl font-semibold">{offline ? 'Sem conexão com a internet' : 'Algo deu errado'}</h1>
      <p className="max-w-sm text-slate-500 dark:text-slate-400">
        {offline
          ? 'Esta parte do app ainda não foi baixada. Conecte-se e tente novamente.'
          : 'Ocorreu um erro inesperado. Recarregue a página para continuar.'}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Recarregar
      </button>
    </main>
  )
}
