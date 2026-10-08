-- Métricas do dashboard do vendedor logado, calculadas no banco (fuso de Brasília).
-- p_dias: tamanho do período (7, 30 ou 90) terminando hoje.
-- p_estoque_baixo: limite para considerar estoque baixo.
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
           (pe.criado_em AT TIME ZONE v_tz)::date AS dia
    FROM public.fertex_itens_pedido i
    JOIN public.fertex_pedidos pe ON pe.id = i.pedido_id
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
        SELECT pr.id AS produto_id, pr.nome, sum(p.quantidade)::int AS quantidade, sum(p.valor) AS faturamento
        FROM periodo p JOIN public.fertex_produtos pr ON pr.id = p.produto_id
        GROUP BY pr.id, pr.nome
        ORDER BY 3 DESC, 4 DESC
        LIMIT 5
      ) t
    ),
    'estoque_baixo', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'estoque', estoque) ORDER BY estoque, nome), '[]'::jsonb)
      FROM public.fertex_produtos
      WHERE vendedor_id = v_uid AND ativo AND estoque <= p_estoque_baixo
    )
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_dashboard_vendedor(int, int) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_dashboard_vendedor(int, int) TO authenticated;
