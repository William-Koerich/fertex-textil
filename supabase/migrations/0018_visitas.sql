CREATE TABLE "fertex_ip_geo" (
	"ip" text PRIMARY KEY NOT NULL,
	"cidade" text,
	"regiao" text,
	"regiao_sigla" text,
	"pais" text,
	"pais_sigla" text,
	"request_id" bigint,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fertex_ip_geo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fertex_visitas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"vendedor_id" uuid,
	"produto_id" uuid,
	"origem" text DEFAULT 'direto' NOT NULL,
	"referrer" text,
	"visitante" text,
	"ip" text
);
--> statement-breakpoint
ALTER TABLE "fertex_visitas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fertex_visitas" ADD CONSTRAINT "fertex_visitas_vendedor_id_fertex_profiles_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."fertex_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fertex_visitas" ADD CONSTRAINT "fertex_visitas_produto_id_fertex_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."fertex_produtos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fertex_visitas_vendedor_idx" ON "fertex_visitas" USING btree ("vendedor_id","criado_em");--> statement-breakpoint
CREATE INDEX "fertex_visitas_produto_idx" ON "fertex_visitas" USING btree ("produto_id");--> statement-breakpoint
CREATE INDEX "fertex_visitas_ip_idx" ON "fertex_visitas" USING btree ("ip");