import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL
const key = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no arquivo .env (veja .env.example).',
  )
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fertex-auth' },
})

export const BUCKET_PRODUTOS = 'fertex-produtos'
