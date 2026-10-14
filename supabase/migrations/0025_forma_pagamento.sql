CREATE TYPE "public"."fertex_forma_pagamento" AS ENUM('pix', 'dinheiro', 'boleto', 'cheque');--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ADD COLUMN "forma_pagamento" "fertex_forma_pagamento";--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ADD COLUMN "prazo_pagamento" text;--> statement-breakpoint
ALTER TABLE "fertex_pedidos" ADD CONSTRAINT "fertex_pedidos_prazo_check" CHECK ("fertex_pedidos"."prazo_pagamento" is null or ("fertex_pedidos"."forma_pagamento" in ('boleto', 'cheque') and "fertex_pedidos"."prazo_pagamento" ~ '^[0-9]{1,3}(/[0-9]{1,3}){0,11}$'));