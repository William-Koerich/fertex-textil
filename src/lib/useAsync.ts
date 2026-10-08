import { useCallback, useEffect, useRef, useState } from 'react'
import type { DependencyList } from 'react'
import { mensagemErro } from './errors'

interface AsyncState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
  setData: (updater: (prev: T | undefined) => T | undefined) => void
}

/** Executa uma função assíncrona ao montar / quando as dependências mudam, com estados de carregamento e erro. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setDataState] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)
    fnRef
      .current()
      .then((d) => ativo && setDataState(d))
      .catch((e) => ativo && setError(mensagemErro(e)))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const setData = useCallback((u: (prev: T | undefined) => T | undefined) => setDataState(u), [])

  return { data, error, loading, reload, setData }
}
