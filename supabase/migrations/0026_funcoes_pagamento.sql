-- ============================================================================
-- Forma de pagamento (Pix, dinheiro, boleto, cheque) e prazo (boleto/cheque) em cada venda
-- ============================================================================
-- Valida a forma de pagamento e normaliza o prazo ("30 60 90", "30,60,90" → "30/60/90").
-- Boleto e cheque exigem prazo; Pix e dinheiro não têm prazo.
CREATE OR REPLACE FUNCTION public.fertex_normalizar_prazo(p_forma public.fertex_forma_pagamento, p_prazo text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v text := trim(both '/' FROM regexp_replace(coalesce(p_prazo, ''), '[^0-9]+', '/', 'g'));
BEGIN
  IF p_forma IS NULL THEN
    RAISE EXCEPTION 'Informe a forma de pagamento.';
  END IF;
  IF p_forma NOT IN ('boleto', 'cheque') THEN
    RETURN NULL;
  END IF;
  IF v = '' THEN
    RAISE EXCEPTION 'Informe o prazo do % em dias (ex.: 30/60/90).', CASE p_forma WHEN 'boleto' THEN 'boleto' ELSE 'cheque' END;
  END IF;
  IF v !~ '^[0-9]{1,3}(/[0-9]{1,3}){0,11}$' THEN
    RAISE EXCEPTION 'Prazo inválido. Use os dias separados por barra, ex.: 30/60/90.';
  END IF;
  RETURN v;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_normalizar_prazo(public.fertex_forma_pagamento, text) FROM public, anon;
--> statement-breakpoint
-- Venda direta: forma de pagamento obrigatória
DROP FUNCTION IF EXISTS public.fertex_registrar_venda(uuid, int, text, numeric, text);
--> statement-breakpoint
CREATE FUNCTION public.fertex_registrar_venda(
  p_produto_id uuid,
  p_quantidade int,
  p_cliente_nome text DEFAULT NULL,
  p_preco_unitario numeric DEFAULT NULL,
  p_cor text DEFAULT NULL,
  p_forma_pagamento public.fertex_forma_pagamento DEFAULT NULL,
  p_prazo_pagamento text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prod record;
  v_preco numeric(12, 2);
  v_pedido uuid;
  v_cor text := nullif(trim(p_cor), '');
  v_prazo text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.fertex_profiles WHERE id = v_uid AND perfil = 'vendedor') THEN
    RAISE EXCEPTION 'Apenas vendedores podem registrar vendas.';
  END IF;

  v_prazo := public.fertex_normalizar_prazo(p_forma_pagamento, p_prazo_pagamento);

  IF p_quantidade IS NULL OR p_quantidade < 1 OR p_quantidade > 100000 THEN
    RAISE EXCEPTION 'Informe uma quantidade válida.';
  END IF;

  SELECT id, nome, preco, estoque, vendedor_id, excluido_em, coalesce(cores, '{}') AS cores INTO v_prod
  FROM public.fertex_produtos WHERE id = p_produto_id
  FOR UPDATE;

  -- Produto inexistente ou de outro vendedor: mesma mensagem (não revela produtos alheios)
  IF v_prod.id IS NULL OR v_prod.vendedor_id <> v_uid OR v_prod.excluido_em IS NOT NULL THEN
    RAISE EXCEPTION 'Produto não encontrado.';
  END IF;

  IF v_prod.estoque < p_quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %.', v_prod.nome, v_prod.estoque
      USING DETAIL = v_prod.id::text, HINT = 'estoque';
  END IF;

  IF cardinality(v_prod.cores) = 0 THEN
    v_cor := NULL;
  ELSIF v_cor IS NULL OR NOT v_cor = ANY (v_prod.cores) THEN
    RAISE EXCEPTION 'Escolha uma das cores do produto.';
  END IF;

  v_preco := coalesce(p_preco_unitario, v_prod.preco);
  IF v_preco < 0 OR v_preco > 9999999 THEN
    RAISE EXCEPTION 'Preço inválido.';
  END IF;

  INSERT INTO public.fertex_pedidos (comprador_id, total, status, origem, cliente_nome, forma_pagamento, prazo_pagamento, concluido_em)
  VALUES (NULL, v_preco * p_quantidade, 'concluido', 'manual', nullif(left(trim(p_cliente_nome), 120), ''), p_forma_pagamento, v_prazo, now())
  RETURNING id INTO v_pedido;

  INSERT INTO public.fertex_itens_pedido (pedido_id, produto_id, vendedor_id, quantidade, preco_unitario, cor)
  VALUES (v_pedido, v_prod.id, v_uid, p_quantidade, v_preco, v_cor);

  UPDATE public.fertex_produtos SET estoque = estoque - p_quantidade WHERE id = v_prod.id;

  RETURN v_pedido;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_registrar_venda(uuid, int, text, numeric, text, public.fertex_forma_pagamento, text) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_registrar_venda(uuid, int, text, numeric, text, public.fertex_forma_pagamento, text) TO authenticated;
--> statement-breakpoint
-- Marcar como vendido: forma de pagamento obrigatória
DROP FUNCTION IF EXISTS public.fertex_concluir_pedido(uuid);
--> statement-breakpoint
CREATE FUNCTION public.fertex_concluir_pedido(
  p_pedido_id uuid,
  p_forma_pagamento public.fertex_forma_pagamento DEFAULT NULL,
  p_prazo_pagamento text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status public.fertex_status_pedido;
  v_prazo text;
  r record;
BEGIN
  SELECT status INTO v_status FROM public.fertex_pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF v_status IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.fertex_itens_pedido WHERE pedido_id = p_pedido_id AND vendedor_id = v_uid)
     OR EXISTS (SELECT 1 FROM public.fertex_itens_pedido WHERE pedido_id = p_pedido_id AND vendedor_id <> v_uid) THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;
  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION 'Este pedido já foi %.', CASE v_status WHEN 'concluido' THEN 'marcado como vendido' ELSE 'cancelado' END;
  END IF;

  v_prazo := public.fertex_normalizar_prazo(p_forma_pagamento, p_prazo_pagamento);

  PERFORM 1 FROM public.fertex_produtos
  WHERE id IN (SELECT produto_id FROM public.fertex_itens_pedido WHERE pedido_id = p_pedido_id)
  ORDER BY id FOR UPDATE;

  FOR r IN
    SELECT p.nome, p.estoque, p.excluido_em, sum(i.quantidade)::int AS quantidade
    FROM public.fertex_itens_pedido i JOIN public.fertex_produtos p ON p.id = i.produto_id
    WHERE i.pedido_id = p_pedido_id
    GROUP BY p.id
  LOOP
    IF r.excluido_em IS NOT NULL THEN
      RAISE EXCEPTION 'O produto "%" foi excluído. Cancele este pedido.', r.nome;
    END IF;
    IF r.estoque < r.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, no pedido %. Ajuste o estoque ou cancele o pedido.',
        r.nome, r.estoque, r.quantidade USING HINT = 'estoque';
    END IF;
  END LOOP;

  UPDATE public.fertex_produtos p SET estoque = p.estoque - t.quantidade
  FROM (
    SELECT produto_id, sum(quantidade)::int AS quantidade
    FROM public.fertex_itens_pedido WHERE pedido_id = p_pedido_id GROUP BY produto_id
  ) t
  WHERE p.id = t.produto_id;

  UPDATE public.fertex_pedidos
  SET status = 'concluido', concluido_em = now(), forma_pagamento = p_forma_pagamento, prazo_pagamento = v_prazo
  WHERE id = p_pedido_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_concluir_pedido(uuid, public.fertex_forma_pagamento, text) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_concluir_pedido(uuid, public.fertex_forma_pagamento, text) TO authenticated;
--> statement-breakpoint
-- Listas trazem a forma de pagamento
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
      pe.forma_pagamento, pe.prazo_pagamento,
      coalesce(co.nome, pe.cliente_nome) AS comprador_nome,
      (SELECT jsonb_agg(jsonb_build_object(
          'produto_id', i.produto_id, 'nome', pr.nome, 'foto_url', pr.foto_url,
          'quantidade', i.quantidade, 'preco_unitario', i.preco_unitario, 'unidade', i.unidade, 'cor', i.cor,
          'estoque', pr.estoque, 'excluido', pr.excluido_em IS NOT NULL) ORDER BY pr.nome, i.cor)
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
REVOKE ALL ON FUNCTION public.fertex_vendas_vendedor(date, date, uuid) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_vendas_vendedor(date, date, uuid) TO authenticated;
