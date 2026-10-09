ALTER TABLE "fertex_itens_pedido" ADD COLUMN "cor" text;--> statement-breakpoint
ALTER TABLE "fertex_produtos" ADD COLUMN "cores" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "fertex_produtos" ADD CONSTRAINT "fertex_produtos_cores_check" CHECK (cardinality("fertex_produtos"."cores") <= 50 and array_position("fertex_produtos"."cores", '') is null);