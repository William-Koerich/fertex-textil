CREATE TABLE "fertex_geo_coordenadas" (
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"bairro" text,
	"cidade" text,
	"uf" text,
	"pais_sigla" text,
	"request_id" bigint,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fertex_geo_coordenadas_lat_lon_pk" PRIMARY KEY("lat","lon")
);
--> statement-breakpoint
ALTER TABLE "fertex_geo_coordenadas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fertex_visitas" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "fertex_visitas" ADD COLUMN "lon" double precision;--> statement-breakpoint
ALTER TABLE "fertex_visitas" ADD COLUMN "precisao_m" integer;