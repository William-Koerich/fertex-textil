/**
 * Schema do banco (Drizzle). As migrations são geradas em /supabase/migrations com `npm run db:generate`.
 * Funções, triggers e Storage ficam em migrations SQL customizadas (ver supabase/migrations).
 *
 * Este arquivo também é importado pelo front-end apenas como tipos (`import type`).
 */
import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUid, authUsers } from 'drizzle-orm/supabase'

export const perfilEnum = pgEnum('fertex_perfil', ['vendedor', 'comprador'])
export const statusPedidoEnum = pgEnum('fertex_status_pedido', ['pendente', 'concluido', 'cancelado'])

const criadoEm = () => timestamp('criado_em', { withTimezone: true, mode: 'string' }).notNull().defaultNow()

export const profiles = pgTable(
  'fertex_profiles',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    perfil: perfilEnum('perfil').notNull(),
    criado_em: criadoEm(),
  },
  () => [
    // Cada usuário lê apenas o próprio perfil. A criação é feita pelo trigger fertex_on_auth_user_created.
    pgPolicy('fertex_profiles_select_proprio', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = id`,
    }),
  ],
).enableRLS()

export const produtos = pgTable(
  'fertex_produtos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendedor_id: uuid('vendedor_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    descricao: text('descricao').notNull().default(''),
    preco: numeric('preco', { precision: 12, scale: 2, mode: 'number' }).notNull(),
    estoque: integer('estoque').notNull().default(0),
    categoria: text('categoria').notNull(),
    foto_url: text('foto_url'),
    ativo: boolean('ativo').notNull().default(true),
    criado_em: criadoEm(),
  },
  (t) => [
    index('fertex_produtos_vendedor_idx').on(t.vendedor_id),
    index('fertex_produtos_ativo_idx').on(t.ativo),
    check('fertex_produtos_preco_check', sql`${t.preco} >= 0`),
    check('fertex_produtos_estoque_check', sql`${t.estoque} >= 0`),
    check('fertex_produtos_nome_check', sql`char_length(trim(${t.nome})) between 2 and 120`),
    // Leitura: produtos ativos, os próprios (mesmo inativos) e os que aparecem em pedidos visíveis ao usuário
    pgPolicy('fertex_produtos_select', {
      for: 'select',
      to: authenticatedRole,
      using: sql`ativo or vendedor_id = ${authUid} or id in (select i.produto_id from fertex_itens_pedido i)`,
    }),
    pgPolicy('fertex_produtos_insert_vendedor', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`vendedor_id = ${authUid} and exists (select 1 from fertex_profiles p where p.id = ${authUid} and p.perfil = 'vendedor')`,
    }),
    pgPolicy('fertex_produtos_update_dono', {
      for: 'update',
      to: authenticatedRole,
      using: sql`vendedor_id = ${authUid}`,
      withCheck: sql`vendedor_id = ${authUid}`,
    }),
    pgPolicy('fertex_produtos_delete_dono', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`vendedor_id = ${authUid}`,
    }),
  ],
).enableRLS()

export const pedidos = pgTable(
  'fertex_pedidos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    comprador_id: uuid('comprador_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    total: numeric('total', { precision: 12, scale: 2, mode: 'number' }).notNull(),
    status: statusPedidoEnum('status').notNull().default('concluido'),
    criado_em: criadoEm(),
  },
  (t) => [
    index('fertex_pedidos_comprador_idx').on(t.comprador_id, t.criado_em),
    index('fertex_pedidos_criado_em_idx').on(t.criado_em),
    // Escrita só pela função fertex_finalizar_compra (security definer)
    pgPolicy('fertex_pedidos_select_comprador', {
      for: 'select',
      to: authenticatedRole,
      using: sql`comprador_id = ${authUid}`,
    }),
  ],
).enableRLS()

export const itensPedido = pgTable(
  'fertex_itens_pedido',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pedido_id: uuid('pedido_id')
      .notNull()
      .references(() => pedidos.id, { onDelete: 'cascade' }),
    // restrict: produto com vendas não pode ser excluído (deve ser desativado)
    produto_id: uuid('produto_id')
      .notNull()
      .references(() => produtos.id, { onDelete: 'restrict' }),
    vendedor_id: uuid('vendedor_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    quantidade: integer('quantidade').notNull(),
    preco_unitario: numeric('preco_unitario', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  },
  (t) => [
    index('fertex_itens_pedido_pedido_idx').on(t.pedido_id),
    index('fertex_itens_pedido_vendedor_idx').on(t.vendedor_id),
    index('fertex_itens_pedido_produto_idx').on(t.produto_id),
    check('fertex_itens_pedido_quantidade_check', sql`${t.quantidade} > 0`),
    check('fertex_itens_pedido_preco_check', sql`${t.preco_unitario} >= 0`),
    // Vendedor vê os itens dos próprios produtos; comprador vê os itens dos próprios pedidos
    pgPolicy('fertex_itens_pedido_select', {
      for: 'select',
      to: authenticatedRole,
      using: sql`vendedor_id = ${authUid} or pedido_id in (select p.id from fertex_pedidos p where p.comprador_id = ${authUid})`,
    }),
  ],
).enableRLS()

export type Perfil = (typeof perfilEnum.enumValues)[number]
export type StatusPedido = (typeof statusPedidoEnum.enumValues)[number]
export type Profile = typeof profiles.$inferSelect
export type Produto = typeof produtos.$inferSelect
export type Pedido = typeof pedidos.$inferSelect
export type ItemPedido = typeof itensPedido.$inferSelect
