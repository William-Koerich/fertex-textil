ALTER TYPE "public"."fertex_origem_pedido" ADD VALUE 'whatsapp';--> statement-breakpoint
ALTER TABLE "fertex_pedidos" DROP CONSTRAINT "fertex_pedidos_origem_check";--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ADD COLUMN "observacao" text;--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ADD COLUMN "concluido_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fertex_profiles" ADD COLUMN "whatsapp" text;--> statement-breakpoint
CREATE INDEX "fertex_pedidos_status_idx" ON "fertex_pedidos" USING btree ("status");--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ADD CONSTRAINT "fertex_pedidos_origem_check" CHECK ("fertex_pedidos"."comprador_id" is not null or "fertex_pedidos"."origem" = 'manual');--> statement-breakpoint
ALTER TABLE "fertex_profiles" ADD CONSTRAINT "fertex_profiles_whatsapp_check" CHECK ("fertex_profiles"."whatsapp" ~ '^[0-9]{10,15}$');--> statement-breakpoint
CREATE POLICY "fertex_produtos_select_publico" ON "fertex_produtos" AS PERMISSIVE FOR SELECT TO "anon" USING (ativo);--> statement-breakpoint
CREATE POLICY "fertex_profiles_update_proprio" ON "fertex_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);