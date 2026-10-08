import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="text-slate-500 dark:text-slate-400">O endereço que você acessou não existe.</p>
      <Link to="/" className="mt-2 font-medium text-brand-600 hover:underline dark:text-brand-400">
        Voltar para o início
      </Link>
    </div>
  )
}
