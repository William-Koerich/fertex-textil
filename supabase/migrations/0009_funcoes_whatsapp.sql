-- ============================================================================
-- Vitrine pública + pedidos pelo WhatsApp
-- ============================================================================

-- Visitantes sem login podem ler produtos (a policy fertex_produtos_select_publico limita aos ativos)
GRANT SELECT ON public.fertex_produtos TO anon;
--> statement-breakpoint
-- No perfil, o usuário só pode alterar nome e WhatsApp (nunca o perfil vendedor/comprador)
REVOKE UPDATE ON public.fertex_profiles FROM authenticated;
--> statement-breakpoint
GRANT UPDATE (nome, whatsapp) ON public.fertex_profiles TO authenticated;
--> statement-breakpoint

-- Nome público dos vendedores que têm produtos ativos (cabeçalho da loja e "Vendido por")
CREATE OR REPLACE FUNCTION public.fertex_vendedores_publicos()
RETURNS TABLE (id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.nome
  FROM public.fertex_profiles p
  WHERE p.perfil = 'vendedor'
    AND EXISTS (SELECT 1 FROM public.fertex_produtos pr WHERE pr.vendedor_id = p.id AND pr.ativo);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_vendedores_publicos() FROM public;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_vendedores_publicos() TO anon, authenticated;
--> statement-breakpoint

-- Comprador envia o pedido: cria um pedido PENDENTE por vendedor (sem baixar estoque) e devolve
-- os dados para montar a mensagem do WhatsApp de cada vendedor.
-- Entrada: [{ "produto_id": "uuid", "quantidade": 2 }, ...]
CREATE OR REPLACE FUNCTION public.fertex_enviar_pedido_whatsapp(p_itens jsonb, p_observacao text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_obs text := nullif(left(trim(p_observacao), 500), '');
  v_resultado jsonb := '[]'::jsonb;
  r record;
  v_vend record;
  v_pedido uuid;
  v_total numeric(12, 2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para enviar o pedido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fertex_profiles WHERE id = v_uid AND perfil = 'comprador') THEN
    RAISE EXCEPTION 'Apenas compradores podem fazer pedidos.';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Seu carrinho está vazio.';
  END IF;
  IF jsonb_array_length(p_itens) > 100 THEN
    RAISE EXCEPTION 'O carrinho pode ter no máximo 100 itens.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_itens) e
    WHERE jsonb_typeof(e -> 'quantidade') <> 'number'
       OR (e ->> 'quantidade')::numeric <> trunc((e ->> 'quantidade')::numeric)
       OR (e ->> 'quantidade')::numeric NOT BETWEEN 1 AND 100000
       OR (e ->> 'produto_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'Itens do carrinho inválidos.';
  END IF;

  CREATE TEMP TABLE fertex_tmp_pedido ON COMMIT DROP AS
    SELECT i.produto_id, i.quantidade, p.nome, p.preco, p.estoque, p.ativo, p.vendedor_id
    FROM (
      SELECT (e ->> 'produto_id')::uuid AS produto_id, sum((e ->> 'quantidade')::int)::int AS quantidade
      FROM jsonb_array_elements(p_itens) e GROUP BY 1
    ) i
    LEFT JOIN public.fertex_produtos p ON p.id = i.produto_id;

  -- Disponibilidade (o estoque só é baixado quando o vendedor marcar como vendido)
  FOR r IN SELECT * FROM fertex_tmp_pedido LOOP
    IF r.nome IS NULL OR NOT r.ativo THEN
      RAISE EXCEPTION 'Um produto do seu carrinho não está mais disponível%.', coalesce(' ("' || r.nome || '")', '')
        USING DETAIL = r.produto_id::text, HINT = 'indisponivel';
    END IF;
    IF r.estoque < r.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, no carrinho %.', r.nome, r.estoque, r.quantidade
        USING DETAIL = r.produto_id::text, HINT = 'estoque';
    END IF;
  END LOOP;

  -- Todos os vendedores precisam ter WhatsApp cadastrado
  SELECT pf.nome INTO v_vend
  FROM (SELECT DISTINCT vendedor_id FROM fertex_tmp_pedido) t
  JOIN public.fertex_profiles pf ON pf.id = t.vendedor_id
  WHERE pf.whatsapp IS NULL
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'O vendedor "%" ainda não cadastrou um WhatsApp para receber pedidos.', v_vend.nome;
  END IF;

  -- Um pedido por vendedor
  FOR v_vend IN
    SELECT pf.id, pf.nome, pf.whatsapp
    FROM (SELECT DISTINCT vendedor_id FROM fertex_tmp_pedido) t
    JOIN public.fertex_profiles pf ON pf.id = t.vendedor_id
    ORDER BY pf.nome
  LOOP
    SELECT sum(preco * quantidade) INTO v_total FROM fertex_tmp_pedido WHERE vendedor_id = v_vend.id;

    INSERT INTO public.fertex_pedidos (comprador_id, total, status, origem, observacao)
    VALUES (v_uid, v_total, 'pendente', 'whatsapp', v_obs)
    RETURNING id INTO v_pedido;

    INSERT INTO public.fertex_itens_pedido (pedido_id, produto_id, vendedor_id, quantidade, preco_unitario)
    SELECT v_pedido, produto_id, vendedor_id, quantidade, preco FROM fertex_tmp_pedido WHERE vendedor_id = v_vend.id;

    v_resultado := v_resultado || jsonb_build_object(
      'pedido_id', v_pedido,
      'vendedor_nome', v_vend.nome,
      'whatsapp', v_vend.whatsapp,
      'total', v_total,
      'itens', (
        SELECT jsonb_agg(jsonb_build_object('nome', nome, 'quantidade', quantidade, 'preco_unitario', preco) ORDER BY nome)
        FROM fertex_tmp_pedido WHERE vendedor_id = v_vend.id
      )
    );
  END LOOP;

  DROP TABLE fertex_tmp_pedido;
  RETURN v_resultado;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_enviar_pedido_whatsapp(jsonb, text) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_enviar_pedido_whatsapp(jsonb, text) TO authenticated;
--> statement-breakpoint

-- Vendedor marca um pedido pendente como vendido: trava os produtos, confere estoque e baixa.
CREATE OR REPLACE FUNCTION public.fertex_concluir_pedido(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status public.fertex_status_pedido;
  r record;
BEGIN
  SELECT status INTO v_status FROM public.fertex_pedidos WHERE id = p_pedido_id FOR UPDATE;
  -- Pedido precisa existir e todos os itens serem do vendedor logado
  IF v_status IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.fertex_itens_pedido WHERE pedido_id = p_pedido_id AND vendedor_id = v_uid)
     OR EXISTS (SELECT 1 FROM public.fertex_itens_pedido WHERE pedido_id = p_pedido_id AND vendedor_id <> v_uid) THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;
  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION 'Este pedido já foi %.', CASE v_status WHEN 'concluido' THEN 'marcado como vendido' ELSE 'cancelado' END;
  END IF;

  PERFORM 1 FROM public.fertex_produtos
  WHERE id IN (SELECT produto_id FROM public.fertex_itens_pedido WHERE pedido_id = p_pedido_id)
  ORDER BY id FOR UPDATE;

  FOR r IN
    SELECT p.nome, p.estoque, i.quantidade
    FROM public.fertex_itens_pedido i JOIN public.fertex_produtos p ON p.id = i.produto_id
    WHERE i.pedido_id = p_pedido_id
  LOOP
    IF r.estoque < r.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, no pedido %. Ajuste o estoque ou cancele o pedido.',
        r.nome, r.estoque, r.quantidade USING HINT = 'estoque';
    END IF;
  END LOOP;

  UPDATE public.fertex_produtos p SET estoque = p.estoque - i.quantidade
  FROM public.fertex_itens_pedido i
  WHERE i.pedido_id = p_pedido_id AND p.id = i.produto_id;

  UPDATE public.fertex_pedidos SET status = 'concluido', concluido_em = now() WHERE id = p_pedido_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_concluir_pedido(uuid) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_concluir_pedido(uuid) TO authenticated;
--> statement-breakpoint

-- Cancela um pedido pendente (pelo vendedor dos itens ou pelo próprio comprador). Não mexe no estoque.
CREATE OR REPLACE FUNCTION public.fertex_cancelar_pedido(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pedido record;
BEGIN
  SELECT id, status, comprador_id INTO v_pedido FROM public.fertex_pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF v_pedido.id IS NULL OR NOT (
    v_pedido.comprador_id = v_uid
    OR EXISTS (SELECT 1 FROM public.fertex_itens_pedido WHERE pedido_id = p_pedido_id AND vendedor_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;
  IF v_pedido.status <> 'pendente' THEN
    RAISE EXCEPTION 'Só é possível cancelar pedidos aguardando confirmação.';
  END IF;
  UPDATE public.fertex_pedidos SET status = 'cancelado' WHERE id = p_pedido_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_cancelar_pedido(uuid) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_cancelar_pedido(uuid) TO authenticated;
--> statement-breakpoint

-- Pedidos recebidos pelo vendedor logado (com nome do comprador e itens)
CREATE OR REPLACE FUNCTION public.fertex_pedidos_recebidos(p_status public.fertex_status_pedido DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x.criado_em DESC), '[]'::jsonb)
  FROM (
    SELECT
      pe.id, pe.status, pe.origem, pe.total, pe.observacao, pe.criado_em, pe.concluido_em,
      coalesce(co.nome, pe.cliente_nome) AS comprador_nome,
      (SELECT jsonb_agg(jsonb_build_object(
          'produto_id', i.produto_id, 'nome', pr.nome, 'foto_url', pr.foto_url,
          'quantidade', i.quantidade, 'preco_unitario', i.preco_unitario, 'estoque', pr.estoque) ORDER BY pr.nome)
       FROM public.fertex_itens_pedido i JOIN public.fertex_produtos pr ON pr.id = i.produto_id
       WHERE i.pedido_id = pe.id) AS itens
    FROM public.fertex_pedidos pe
    LEFT JOIN public.fertex_profiles co ON co.id = pe.comprador_id
    -- Pedidos feitos por compradores (vendas manuais ficam só em "Produtos vendidos");
    -- pendentes sempre aparecem, os demais dos últimos 180 dias
    WHERE pe.comprador_id IS NOT NULL
      AND (pe.status = 'pendente' OR pe.criado_em > now() - interval '180 days')
  ) x
  WHERE EXISTS (SELECT 1 FROM public.fertex_itens_pedido i WHERE i.pedido_id = x.id AND i.vendedor_id = auth.uid())
    AND (p_status IS NULL OR x.status = p_status)
  LIMIT 500;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_pedidos_recebidos(public.fertex_status_pedido) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_pedidos_recebidos(public.fertex_status_pedido) TO authenticated;
--> statement-breakpoint

-- Pedidos do comprador logado, com nome e WhatsApp do vendedor (para reenviar a mensagem)
CREATE OR REPLACE FUNCTION public.fertex_meus_pedidos()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x.criado_em DESC), '[]'::jsonb)
  FROM (
    SELECT
      pe.id, pe.status, pe.origem, pe.total, pe.observacao, pe.criado_em, pe.concluido_em,
      ve.nome AS vendedor_nome,
      ve.whatsapp AS vendedor_whatsapp,
      (SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'produto_id', i.produto_id, 'nome', pr.nome, 'foto_url', pr.foto_url,
          'quantidade', i.quantidade, 'preco_unitario', i.preco_unitario) ORDER BY pr.nome)
       FROM public.fertex_itens_pedido i JOIN public.fertex_produtos pr ON pr.id = i.produto_id
       WHERE i.pedido_id = pe.id) AS itens
    FROM public.fertex_pedidos pe
    LEFT JOIN LATERAL (
      SELECT pf.nome, pf.whatsapp FROM public.fertex_itens_pedido i
      JOIN public.fertex_profiles pf ON pf.id = i.vendedor_id
      WHERE i.pedido_id = pe.id LIMIT 1
    ) ve ON true
    WHERE pe.comprador_id = auth.uid()
    ORDER BY pe.criado_em DESC
    LIMIT 200
  ) x;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_meus_pedidos() FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_meus_pedidos() TO authenticated;
--> statement-breakpoint

-- Vendas e painel passam a usar a data em que a venda foi concluída (pedido pelo WhatsApp:
-- quando o vendedor marcou como vendido). Pedidos antigos usam a data de criação.
CREATE OR REPLACE FUNCTION public.fertex_vendas_vendedor(
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
    i.preco_unitario,
    i.quantidade * i.preco_unitario
  FROM public.fertex_itens_pedido i
  JOIN public.fertex_pedidos pe ON pe.id = i.pedido_id
  JOIN public.fertex_produtos pr ON pr.id = i.produto_id
  LEFT JOIN public.fertex_profiles co ON co.id = pe.comprador_id
  WHERE i.vendedor_id = auth.uid()
    AND pe.status = 'concluido'
    AND (p_inicio IS NULL OR coalesce(pe.concluido_em, pe.criado_em) >= (p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'))
    AND (p_fim IS NULL OR coalesce(pe.concluido_em, pe.criado_em) < ((p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'))
    AND (p_produto_id IS NULL OR i.produto_id = p_produto_id)
  ORDER BY coalesce(pe.concluido_em, pe.criado_em) DESC, pr.nome
  LIMIT 5000;
$$;
--> statement-breakpoint
-- Painel: mesma função da 0005, agora usando a data de conclusão da venda.
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
           (coalesce(pe.concluido_em, pe.criado_em) AT TIME ZONE v_tz)::date AS dia
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
