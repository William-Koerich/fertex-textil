import { isRouteErrorResponse, useRouteError } from 'react-router'
import { useState } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { recuperarVersao } from '@/lib/recuperarVersao'
import NotFoundPage from './NotFoundPage'

/** Erro inesperado em qualquer rota (inclui falha ao baixar um trecho do app, ex. sem internet). */
export default function RouteErrorPage() {
  const erro = useRouteError()
  // Tela que não baixou depois de uma nova publicação: busca o arquivo de novo e recarrega (uma vez)
  const [atualizando] = useState(() => recuperarVersao(erro))
  if (isRouteErrorResponse(erro) && erro.status === 404) return <NotFoundPage />
  if (atualizando)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <RefreshCw className="h-10 w-10 animate-spin text-brand-600" aria-hidden />
        <h1 className="text-lg font-semibold">Atualizando o app…</h1>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">Uma nova versão foi publicada. Só um instante.</p>
      </main>
    )
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
