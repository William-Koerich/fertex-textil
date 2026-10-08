import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida no .env')

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './supabase/migrations',
  dbCredentials: { url: process.env.DATABASE_URL },
  // O banco é compartilhado: o Drizzle só enxerga/gerencia objetos com prefixo fertex
  tablesFilter: ['fertex_*'],
  schemaFilter: ['public'],
  entities: { roles: { provider: 'supabase' } },
  migrations: { schema: 'drizzle', table: 'fertex_migrations' },
  strict: true,
  verbose: true,
})
