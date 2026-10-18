CREATE TYPE "public"."fertex_tipo_ganho" AS ENUM('revenda', 'comissao');--> statement-breakpoint
CREATE TABLE "fertex_itens_custos" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"tipo_ganho" "fertex_tipo_ganho" NOT NULL,
	"custo_unitario" numeric(12, 2),
	"comissao_percentual" numeric(5, 2)
);
--> statement-breakpoint
ALTER TABLE "fertex_itens_custos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fertex_produtos_custos" (
	"produto_id" uuid PRIMARY KEY NOT NULL,
	"tipo_ganho" "fertex_tipo_ganho" NOT NULL,
	"preco_custo" numeric(12, 2),
	"comissao_percentual" numeric(5, 2),
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fertex_produtos_custos_check" CHECK (("fertex_produtos_custos"."tipo_ganho" = 'revenda' and "fertex_produtos_custos"."preco_custo" >= 0 and "fertex_produtos_custos"."comissao_percentual" is null)
        or ("fertex_produtos_custos"."tipo_ganho" = 'comissao' and "fertex_produtos_custos"."comissao_percentual" > 0 and "fertex_produtos_custos"."comissao_percentual" <= 100 and "fertex_produtos_custos"."preco_custo" is null))
);
--> statement-breakpoint
ALTER TABLE "fertex_produtos_custos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fertex_itens_custos" ADD CONSTRAINT "fertex_itens_custos_item_id_fertex_itens_pedido_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."fertex_itens_pedido"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fertex_produtos_custos" ADD CONSTRAINT "fertex_produtos_custos_produto_id_fertex_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."fertex_produtos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "fertex_itens_custos_vendedor" ON "fertex_itens_custos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from fertex_itens_pedido i where i.id = item_id and i.vendedor_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "fertex_produtos_custos_dono" ON "fertex_produtos_custos" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from fertex_produtos p where p.id = produto_id and p.vendedor_id = (select auth.uid()))) WITH CHECK (exists (select 1 from fertex_produtos p where p.id = produto_id and p.vendedor_id = (select auth.uid())));