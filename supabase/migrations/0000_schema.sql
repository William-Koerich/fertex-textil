CREATE TYPE "public"."fertex_perfil" AS ENUM('vendedor', 'comprador');--> statement-breakpoint
CREATE TYPE "public"."fertex_status_pedido" AS ENUM('pendente', 'concluido', 'cancelado');--> statement-breakpoint
CREATE TABLE "fertex_itens_pedido" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"produto_id" uuid NOT NULL,
	"vendedor_id" uuid NOT NULL,
	"quantidade" integer NOT NULL,
	"preco_unitario" numeric(12, 2) NOT NULL,
	CONSTRAINT "fertex_itens_pedido_quantidade_check" CHECK ("fertex_itens_pedido"."quantidade" > 0),
	CONSTRAINT "fertex_itens_pedido_preco_check" CHECK ("fertex_itens_pedido"."preco_unitario" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fertex_itens_pedido" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fertex_pedidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comprador_id" uuid NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"status" "fertex_status_pedido" DEFAULT 'concluido' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fertex_produtos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendedor_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"preco" numeric(12, 2) NOT NULL,
	"estoque" integer DEFAULT 0 NOT NULL,
	"categoria" text NOT NULL,
	"foto_url" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fertex_produtos_preco_check" CHECK ("fertex_produtos"."preco" >= 0),
	CONSTRAINT "fertex_produtos_estoque_check" CHECK ("fertex_produtos"."estoque" >= 0),
	CONSTRAINT "fertex_produtos_nome_check" CHECK (char_length(trim("fertex_produtos"."nome")) between 2 and 120)
);
--> statement-breakpoint
ALTER TABLE "fertex_produtos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fertex_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"perfil" "fertex_perfil" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fertex_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fertex_itens_pedido" ADD CONSTRAINT "fertex_itens_pedido_pedido_id_fertex_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."fertex_pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fertex_itens_pedido" ADD CONSTRAINT "fertex_itens_pedido_produto_id_fertex_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."fertex_produtos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fertex_itens_pedido" ADD CONSTRAINT "fertex_itens_pedido_vendedor_id_fertex_profiles_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."fertex_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ADD CONSTRAINT "fertex_pedidos_comprador_id_fertex_profiles_id_fk" FOREIGN KEY ("comprador_id") REFERENCES "public"."fertex_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fertex_produtos" ADD CONSTRAINT "fertex_produtos_vendedor_id_fertex_profiles_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."fertex_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fertex_profiles" ADD CONSTRAINT "fertex_profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fertex_itens_pedido_pedido_idx" ON "fertex_itens_pedido" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "fertex_itens_pedido_vendedor_idx" ON "fertex_itens_pedido" USING btree ("vendedor_id");--> statement-breakpoint
CREATE INDEX "fertex_itens_pedido_produto_idx" ON "fertex_itens_pedido" USING btree ("produto_id");--> statement-breakpoint
CREATE INDEX "fertex_pedidos_comprador_idx" ON "fertex_pedidos" USING btree ("comprador_id","criado_em");--> statement-breakpoint
CREATE INDEX "fertex_pedidos_criado_em_idx" ON "fertex_pedidos" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "fertex_produtos_vendedor_idx" ON "fertex_produtos" USING btree ("vendedor_id");--> statement-breakpoint
CREATE INDEX "fertex_produtos_ativo_idx" ON "fertex_produtos" USING btree ("ativo");--> statement-breakpoint
CREATE POLICY "fertex_itens_pedido_select" ON "fertex_itens_pedido" AS PERMISSIVE FOR SELECT TO "authenticated" USING (vendedor_id = (select auth.uid()) or pedido_id in (select p.id from fertex_pedidos p where p.comprador_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "fertex_pedidos_select_comprador" ON "fertex_pedidos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (comprador_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "fertex_produtos_select" ON "fertex_produtos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (ativo or vendedor_id = (select auth.uid()) or id in (select i.produto_id from fertex_itens_pedido i));--> statement-breakpoint
CREATE POLICY "fertex_produtos_insert_vendedor" ON "fertex_produtos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (vendedor_id = (select auth.uid()) and exists (select 1 from fertex_profiles p where p.id = (select auth.uid()) and p.perfil = 'vendedor'));--> statement-breakpoint
CREATE POLICY "fertex_produtos_update_dono" ON "fertex_produtos" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (vendedor_id = (select auth.uid())) WITH CHECK (vendedor_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "fertex_produtos_delete_dono" ON "fertex_produtos" AS PERMISSIVE FOR DELETE TO "authenticated" USING (vendedor_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "fertex_profiles_select_proprio" ON "fertex_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = id);