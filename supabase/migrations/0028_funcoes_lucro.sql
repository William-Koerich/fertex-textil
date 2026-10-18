-- ============================================================================
-- Lucro: revenda (preço de venda - preço de compra) e comissão (% sobre o valor da venda)
-- ============================================================================
REVOKE ALL ON public.fertex_produtos_custos, public.fertex_itens_custos FROM anon;
--> statement-breakpoint
-- Lucro de um item vendido. null quando o produto não tem custo/comissão informados.
CREATE OR REPLACE FUNCTION public.fertex_lucro(
  p_tipo public.fertex_tipo_ganho,
  p_preco_unitario numeric,
  p_quantidade int,
  p_custo numeric,
  p_comissao numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_tipo
    WHEN 'revenda' THEN (p_preco_unitario - p_custo) * p_quantidade
    WHEN 'comissao' THEN round(p_preco_unitario * p_quantidade * p_comissao / 100, 2)
  END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_lucro(public.fertex_tipo_ganho, numeric, int, numeric, numeric) FROM public, anon;
--> statement-breakpoint
-- Guarda o custo/comissão do produto no momento da venda (o lucro das vendas antigas não muda
-- quando o vendedor altera o custo depois)
CREATE OR REPLACE FUNCTION public.fertex_itens_copiar_custo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.fertex_itens_custos (item_id, tipo_ganho, custo_unitario, comissao_percentual)
  SELECT new.id, c.tipo_ganho, c.preco_custo, c.comissao_percentual
  FROM public.fertex_produtos_custos c
  WHERE c.produto_id = new.produto_id
  ON CONFLICT (item_id) DO NOTHING;
  RETURN new;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_itens_copiar_custo() FROM public, anon, authenticated;
--> statement-breakpoint
DROP TRIGGER IF EXISTS fertex_itens_custo ON public.fertex_itens_pedido;
--> statement-breakpoint
CREATE TRIGGER fertex_itens_custo AFTER INSERT ON public.fertex_itens_pedido
  FOR EACH ROW EXECUTE FUNCTION public.fertex_itens_copiar_custo();
--> statement-breakpoint
-- Vendas trazem o lucro de cada item (retorno mudou: recriar)
DROP FUNCTION IF EXISTS public.fertex_vendas_vendedor(date, date, uuid);
--> statement-breakpoint
CREATE FUNCTION public.fertex_vendas_vendedor(
  p_inicio date DEFAULT NULL,
  p_fim date DEFAULT NULL,
  p_produto_id uuid DEFAULT NULL
)
RETURNS TABLE (
  item_id uuid,
  pedido_id uuid,
  data timestamptz,
  produto_id uuid,
  produto_nome text,
  comprador_nome text,
  origem public.fertex_origem_pedido,
  quantidade int,
  unidade public.fertex_unidade,
  cor text,
  forma_pagamento public.fertex_forma_pagamento,
  prazo_pagamento text,
  tipo_ganho public.fertex_tipo_ganho,
  lucro numeric,
  preco_unitario numeric,
  total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    i.id,
    i.pedido_id,
    coalesce(pe.concluido_em, pe.criado_em),
    i.produto_id,
    pr.nome,
    coalesce(co.nome, pe.cliente_nome),
    pe.origem,
    i.quantidade,
    i.unidade,
    i.cor,
    pe.forma_pagamento,
    pe.prazo_pagamento,
    coalesce(ic.tipo_ganho, pc.tipo_ganho),
    CASE WHEN ic.item_id IS NOT NULL
      THEN public.fertex_lucro(ic.tipo_ganho, i.preco_unitario, i.quantidade, ic.custo_unitario, ic.comissao_percentual)
      ELSE public.fertex_lucro(pc.tipo_ganho, i.preco_unitario, i.quantidade, pc.preco_custo, pc.comissao_percentual)
    END,
    i.preco_unitario,
    i.quantidade * i.preco_unitario
  FROM public.fertex_itens_pedido i
  JOIN public.fertex_pedidos pe ON pe.id = i.pedido_id
  JOIN public.fertex_produtos pr ON pr.id = i.produto_id
  LEFT JOIN public.fertex_profiles co ON co.id = pe.comprador_id
  LEFT JOIN public.fertex_itens_custos ic ON ic.item_id = i.id
  LEFT JOIN public.fertex_produtos_custos pc ON pc.produto_id = i.produto_id
  WHERE i.vendedor_id = auth.uid()
    AND pe.status = 'concluido'
    AND (p_inicio IS NULL OR coalesce(pe.concluido_em, pe.criado_em) >= (p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'))
    AND (p_fim IS NULL OR coalesce(pe.concluido_em, pe.criado_em) < ((p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'))
    AND (p_produto_id IS NULL OR i.produto_id = p_produto_id)
  ORDER BY coalesce(pe.concluido_em, pe.criado_em) DESC, pr.nome
  LIMIT 5000;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_vendas_vendedor(date, date, uuid) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_vendas_vendedor(date, date, uuid) TO authenticated;
--> statement-breakpoint
-- Painel: lucro total, do mês e do período
CREATE OR REPLACE FUNCTION public.fertex_dashboard_vendedor(p_dias int DEFAULT 30, p_estoque_baixo int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tz text := 'America/Sao_Paulo';
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_inicio date;
  v_resultado jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.fertex_profiles WHERE id = v_uid AND perfil = 'vendedor') THEN
    RAISE EXCEPTION 'Apenas vendedores têm acesso ao painel.';
  END IF;
  IF p_dias NOT BETWEEN 1 AND 366 THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;
  v_inicio := v_hoje - (p_dias - 1);

  WITH vendas AS (
    SELECT i.pedido_id, i.produto_id, i.quantidade, i.quantidade * i.preco_unitario AS valor,
           CASE WHEN ic.item_id IS NOT NULL
             THEN public.fertex_lucro(ic.tipo_ganho, i.preco_unitario, i.quantidade, ic.custo_unitario, ic.comissao_percentual)
             ELSE public.fertex_lucro(pc.tipo_ganho, i.preco_unitario, i.quantidade, pc.preco_custo, pc.comissao_percentual)
           END AS lucro,
           (coalesce(pe.concluido_em, pe.criado_em) AT TIME ZONE v_tz)::date AS dia
    FROM public.fertex_itens_pedido i
    JOIN public.fertex_pedidos pe ON pe.id = i.pedido_id
    LEFT JOIN public.fertex_itens_custos ic ON ic.item_id = i.id
    LEFT JOIN public.fertex_produtos_custos pc ON pc.produto_id = i.produto_id
    WHERE i.vendedor_id = v_uid AND pe.status = 'concluido'
  ),
  periodo AS (SELECT * FROM vendas WHERE dia >= v_inicio),
  anterior AS (SELECT * FROM vendas WHERE dia >= v_inicio - p_dias AND dia < v_inicio)
  SELECT jsonb_build_object(
    'inicio', v_inicio,
    'fim', v_hoje,
    'faturamento_total', (SELECT coalesce(sum(valor), 0) FROM vendas),
    'faturamento_mes', (SELECT coalesce(sum(valor), 0) FROM vendas WHERE dia >= date_trunc('month', v_hoje)::date),
    'faturamento_periodo', (SELECT coalesce(sum(valor), 0) FROM periodo),
    'lucro_total', (SELECT coalesce(sum(lucro), 0) FROM vendas),
    'lucro_mes', (SELECT coalesce(sum(lucro), 0) FROM vendas WHERE dia >= date_trunc('month', v_hoje)::date),
    'lucro_periodo', (SELECT coalesce(sum(lucro), 0) FROM periodo),
    'lucro_periodo_anterior', (SELECT coalesce(sum(lucro), 0) FROM anterior),
    'itens_sem_custo_periodo', (SELECT count(*) FROM periodo WHERE lucro IS NULL),
    'faturamento_periodo_anterior', (SELECT coalesce(sum(valor), 0) FROM anterior),
    'vendas_periodo', (SELECT count(DISTINCT pedido_id) FROM periodo),
    'vendas_periodo_anterior', (SELECT count(DISTINCT pedido_id) FROM anterior),
    'itens_periodo', (SELECT coalesce(sum(quantidade), 0) FROM periodo),
    'serie', (
      SELECT jsonb_agg(jsonb_build_object('dia', d.dia::date, 'faturamento', coalesce(s.valor, 0), 'vendas', coalesce(s.vendas, 0)) ORDER BY d.dia)
      FROM generate_series(v_inicio, v_hoje, interval '1 day') AS d(dia)
      LEFT JOIN (
        SELECT dia, sum(valor) AS valor, count(DISTINCT pedido_id) AS vendas FROM periodo GROUP BY dia
      ) s ON s.dia = d.dia::date
    ),
    'top_produtos', (
      SELECT coalesce(jsonb_agg(t ORDER BY t.quantidade DESC, t.faturamento DESC), '[]'::jsonb)
      FROM (
        SELECT pr.id AS produto_id, pr.nome, pr.unidade, sum(p.quantidade)::int AS quantidade, sum(p.valor) AS faturamento
        FROM periodo p JOIN public.fertex_produtos pr ON pr.id = p.produto_id
        GROUP BY pr.id, pr.nome, pr.unidade
        ORDER BY 3 DESC, 4 DESC
        LIMIT 5
      ) t
    ),
    'estoque_baixo', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'estoque', estoque, 'unidade', unidade) ORDER BY estoque, nome), '[]'::jsonb)
      FROM public.fertex_produtos
      WHERE vendedor_id = v_uid AND ativo AND excluido_em IS NULL AND estoque <= p_estoque_baixo
    )
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;
