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
import { anonRole, authenticatedRole, authUid, authUsers } from 'drizzle-orm/supabase'

export const perfilEnum = pgEnum('fertex_perfil', ['vendedor', 'comprador'])
export const statusPedidoEnum = pgEnum('fertex_status_pedido', ['pendente', 'concluido', 'cancelado'])
/** loja: compra concluída no app · manual: venda registrada pelo vendedor · whatsapp: pedido enviado pelo comprador e confirmado pelo vendedor */
export const origemPedidoEnum = pgEnum('fertex_origem_pedido', ['loja', 'manual', 'whatsapp'])

/** Unidade de medida em que o produto é vendido (preço e estoque são por esta unidade) */
export const unidadeEnum = pgEnum('fertex_unidade', ['kg', 'litro', 'saco', 'unidade', 'caixa', 'rolo', 'metro'])

const criadoEm = () => timestamp('criado_em', { withTimezone: true, mode: 'string' }).notNull().defaultNow()

export const profiles = pgTable(
  'fertex_profiles',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    perfil: perfilEnum('perfil').notNull(),
    /** WhatsApp do vendedor (só dígitos, com DDI: 5547999998888) para receber pedidos */
    whatsapp: text('whatsapp'),
    criado_em: criadoEm(),
  },
  (t) => [
    check('fertex_profiles_whatsapp_check', sql`${t.whatsapp} ~ '^[0-9]{10,15}$'`),
    // Cada usuário lê apenas o próprio perfil. A criação é feita pelo trigger fertex_on_auth_user_created.
    pgPolicy('fertex_profiles_select_proprio', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = id`,
    }),
    // Atualiza só o próprio perfil; as colunas editáveis (nome, whatsapp) são limitadas por GRANT na migration
    pgPolicy('fertex_profiles_update_proprio', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${authUid} = id`,
      withCheck: sql`${authUid} = id`,
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
    unidade: unidadeEnum('unidade').notNull().default('unidade'),
    /** Quantidade mínima por pedido (na unidade do produto). null = sem mínimo */
    quantidade_minima: integer('quantidade_minima'),
    /** Cores disponíveis (vazio = produto sem variação de cor). O estoque é do produto, não por cor. */
    cores: text('cores').array().notNull().default(sql`'{}'::text[]`),
    categoria: text('categoria').notNull(),
    foto_url: text('foto_url'),
    ativo: boolean('ativo').notNull().default(true),
    criado_em: criadoEm(),
    /** Produto excluído que já tinha vendas: some da lista e da loja, mas o histórico de vendas é mantido */
    excluido_em: timestamp('excluido_em', { withTimezone: true, mode: 'string' }),
  },
  (t) => [
    index('fertex_produtos_vendedor_idx').on(t.vendedor_id),
    index('fertex_produtos_ativo_idx').on(t.ativo),
    check('fertex_produtos_preco_check', sql`${t.preco} >= 0`),
    check('fertex_produtos_estoque_check', sql`${t.estoque} >= 0`),
    check('fertex_produtos_cores_check', sql`cardinality(${t.cores}) <= 50 and array_position(${t.cores}, '') is null`),
    check('fertex_produtos_minimo_check', sql`${t.quantidade_minima} is null or ${t.quantidade_minima} >= 1`),
    check('fertex_produtos_nome_check', sql`char_length(trim(${t.nome})) between 2 and 120`),
    // Leitura: produtos ativos, os próprios (mesmo inativos) e os que aparecem em pedidos visíveis ao usuário
    pgPolicy('fertex_produtos_select', {
      for: 'select',
      to: authenticatedRole,
      using: sql`ativo or vendedor_id = ${authUid} or id in (select i.produto_id from fertex_itens_pedido i)`,
    }),
    // Vitrine pública: visitantes sem login veem apenas produtos ativos
    pgPolicy('fertex_produtos_select_publico', {
      for: 'select',
      to: anonRole,
      using: sql`ativo`,
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
    // null em vendas registradas manualmente pelo vendedor
    comprador_id: uuid('comprador_id').references(() => profiles.id, { onDelete: 'cascade' }),
    total: numeric('total', { precision: 12, scale: 2, mode: 'number' }).notNull(),
    status: statusPedidoEnum('status').notNull().default('concluido'),
    origem: origemPedidoEnum('origem').notNull().default('loja'),
    /** nome do cliente informado pelo vendedor em vendas manuais (opcional) */
    cliente_nome: text('cliente_nome'),
    /** observação do comprador no pedido pelo WhatsApp */
    observacao: text('observacao'),
    criado_em: criadoEm(),
    /** quando a venda foi concluída (pedido pelo WhatsApp: quando o vendedor marcou como vendido) */
    concluido_em: timestamp('concluido_em', { withTimezone: true, mode: 'string' }),
  },
  (t) => [
    check('fertex_pedidos_origem_check', sql`${t.comprador_id} is not null or ${t.origem} = 'manual'`),
    index('fertex_pedidos_status_idx').on(t.status),
    index('fertex_pedidos_comprador_idx').on(t.comprador_id, t.criado_em),
    index('fertex_pedidos_criado_em_idx').on(t.criado_em),
    // Escrita só pelas funções fertex_finalizar_compra e fertex_registrar_venda (security definer)
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
    /** unidade no momento da venda (copiada do produto por trigger) */
    unidade: unidadeEnum('unidade').notNull().default('unidade'),
    /** cor escolhida pelo comprador (null quando o produto não tem variação de cor) */
    cor: text('cor'),
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
export type Unidade = (typeof unidadeEnum.enumValues)[number]
export type OrigemPedido = (typeof origemPedidoEnum.enumValues)[number]
export type Profile = typeof profiles.$inferSelect
export type Produto = typeof produtos.$inferSelect
export type Pedido = typeof pedidos.$inferSelect
export type ItemPedido = typeof itensPedido.$inferSelect
