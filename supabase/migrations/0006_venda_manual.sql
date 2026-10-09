CREATE TYPE "public"."fertex_origem_pedido" AS ENUM('loja', 'manual');--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ALTER COLUMN "comprador_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ADD COLUMN "origem" "fertex_origem_pedido" DEFAULT 'loja' NOT NULL;--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ADD COLUMN "cliente_nome" text;--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ADD CONSTRAINT "fertex_pedidos_origem_check" CHECK (("fertex_pedidos"."origem" = 'loja' and "fertex_pedidos"."comprador_id" is not null) or "fertex_pedidos"."origem" = 'manual');