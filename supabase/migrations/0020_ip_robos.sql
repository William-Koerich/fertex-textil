ALTER TABLE "fertex_ip_geo" ADD COLUMN "asn" integer;--> statement-breakpoint
ALTER TABLE "fertex_ip_geo" ADD COLUMN "asn_org" text;--> statement-breakpoint
ALTER TABLE "fertex_ip_geo" ADD COLUMN "robo" boolean DEFAULT false NOT NULL;