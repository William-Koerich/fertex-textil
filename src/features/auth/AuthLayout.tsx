import type { ReactNode } from 'react'
import { InstallButton } from '@/components/pwa/InstallButton'

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <img src="/favicon.svg" alt="" className="h-14 w-14" />
        <div>
          <p className="text-lg font-semibold">
            Fertex <span className="text-brand-600 dark:text-brand-400">Vendas</span>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Seu acelerador de vendas</p>
        </div>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        {children}
      </div>
      <div className="mt-6 w-full max-w-md">
        <InstallButton />
      </div>
    </main>
  )
}
