CREATE TYPE "public"."fertex_unidade" AS ENUM('kg', 'litro', 'saco', 'unidade', 'caixa', 'rolo', 'metro');--> statement-breakpoint
ALTER TABLE "fertex_itens_pedido" ADD COLUMN "unidade" "fertex_unidade" DEFAULT 'unidade' NOT NULL;--> statement-breakpoint
ALTER TABLE "fertex_produtos" ADD COLUMN "unidade" "fertex_unidade" DEFAULT 'unidade' NOT NULL;--> statement-breakpoint
ALTER TABLE "fertex_produtos" ADD COLUMN "excluido_em" timestamp with time zone;