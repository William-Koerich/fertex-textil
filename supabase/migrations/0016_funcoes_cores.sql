-- ============================================================================
-- Variações de cor: o comprador escolhe a cor; o estoque e o pedido mínimo são do produto (soma das cores)
-- ============================================================================

-- Entrada: [{ "produto_id": "uuid", "quantidade": 2, "cor": "Azul" }, ...]
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
       OR coalesce(jsonb_typeof(e -> 'cor'), 'null') NOT IN ('null', 'string')
       OR length(e ->> 'cor') > 60
  ) THEN
    RAISE EXCEPTION 'Itens do carrinho inválidos.';
  END IF;

  -- Uma linha por produto + cor (cor é ignorada em produtos sem variação)
  CREATE TEMP TABLE fertex_tmp_pedido ON COMMIT DROP AS
    SELECT
      x.produto_id, x.cor, sum(x.quantidade)::int AS quantidade,
      p.nome, p.preco, p.estoque, (p.ativo AND p.excluido_em IS NULL) AS ativo,
      p.vendedor_id, p.unidade, p.quantidade_minima, coalesce(p.cores, '{}') AS cores
    FROM (
      SELECT (e ->> 'produto_id')::uuid AS produto_id,
             nullif(trim(e ->> 'cor'), '') AS cor,
             (e ->> 'quantidade')::int AS quantidade
      FROM jsonb_array_elements(p_itens) e
    ) x
    LEFT JOIN public.fertex_produtos p ON p.id = x.produto_id
    GROUP BY x.produto_id, x.cor, p.id;

  UPDATE fertex_tmp_pedido SET cor = NULL WHERE cardinality(cores) = 0;

  FOR r IN SELECT * FROM fertex_tmp_pedido LOOP
    IF r.nome IS NULL OR NOT r.ativo THEN
      RAISE EXCEPTION 'Um produto do seu carrinho não está mais disponível%.', coalesce(' ("' || r.nome || '")', '')
        USING DETAIL = r.produto_id::text, HINT = 'indisponivel';
    END IF;
    IF cardinality(r.cores) > 0 AND (r.cor IS NULL OR NOT r.cor = ANY (r.cores)) THEN
      RAISE EXCEPTION 'Escolha uma cor disponível para "%".', r.nome
        USING DETAIL = r.produto_id::text, HINT = 'cor';
    END IF;
  END LOOP;

  -- Estoque e pedido mínimo são do produto: somam todas as cores
  FOR r IN
    SELECT produto_id, nome, estoque, quantidade_minima, sum(quantidade)::int AS total
    FROM fertex_tmp_pedido GROUP BY produto_id, nome, estoque, quantidade_minima
  LOOP
    IF r.quantidade_minima IS NOT NULL AND r.total < r.quantidade_minima THEN
      RAISE EXCEPTION 'O pedido mínimo de "%" é de % (no carrinho: %).', r.nome, r.quantidade_minima, r.total
        USING DETAIL = r.produto_id::text, HINT = 'minimo';
    END IF;
    IF r.estoque < r.total THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, no carrinho %.', r.nome, r.estoque, r.total
        USING DETAIL = r.produto_id::text, HINT = 'estoque';
    END IF;
  END LOOP;

  SELECT pf.nome INTO v_vend
  FROM (SELECT DISTINCT vendedor_id FROM fertex_tmp_pedido) t
  JOIN public.fertex_profiles pf ON pf.id = t.vendedor_id
  WHERE pf.whatsapp IS NULL
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'O vendedor "%" ainda não cadastrou um WhatsApp para receber pedidos.', v_vend.nome;
  END IF;

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

    INSERT INTO public.fertex_itens_pedido (pedido_id, produto_id, vendedor_id, quantidade, preco_unitario, cor)
    SELECT v_pedido, produto_id, vendedor_id, quantidade, preco, cor FROM fertex_tmp_pedido WHERE vendedor_id = v_vend.id;

    v_resultado := v_resultado || jsonb_build_object(
      'pedido_id', v_pedido,
      'vendedor_nome', v_vend.nome,
      'whatsapp', v_vend.whatsapp,
      'total', v_total,
      'itens', (
        SELECT jsonb_agg(jsonb_build_object('nome', nome, 'cor', cor, 'quantidade', quantidade, 'preco_unitario', preco, 'unidade', unidade) ORDER BY nome, cor)
        FROM fertex_tmp_pedido WHERE vendedor_id = v_vend.id
      )
    );
  END LOOP;

  DROP TABLE fertex_tmp_pedido;
  RETURN v_resultado;
END;
$$;
--> statement-breakpoint

-- Marcar como vendido: confere e baixa o estoque pela SOMA das cores de cada produto
-- (um UPDATE ... FROM com várias linhas do mesmo produto aplicaria só uma delas)
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

  UPDATE public.fertex_pedidos SET status = 'concluido', concluido_em = now() WHERE id = p_pedido_id;
END;
$$;
--> statement-breakpoint
-- Venda direta com cor (assinatura nova)
DROP FUNCTION IF EXISTS public.fertex_registrar_venda(uuid, int, text, numeric);
--> statement-breakpoint
CREATE FUNCTION public.fertex_registrar_venda(
  p_produto_id uuid,
  p_quantidade int,
  p_cliente_nome text DEFAULT NULL,
  p_preco_unitario numeric DEFAULT NULL,
  p_cor text DEFAULT NULL
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
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.fertex_profiles WHERE id = v_uid AND perfil = 'vendedor') THEN
    RAISE EXCEPTION 'Apenas vendedores podem registrar vendas.';
  END IF;

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

  INSERT INTO public.fertex_pedidos (comprador_id, total, status, origem, cliente_nome)
  VALUES (NULL, v_preco * p_quantidade, 'concluido', 'manual', nullif(left(trim(p_cliente_nome), 120), ''))
  RETURNING id INTO v_pedido;

  INSERT INTO public.fertex_itens_pedido (pedido_id, produto_id, vendedor_id, quantidade, preco_unitario, cor)
  VALUES (v_pedido, v_prod.id, v_uid, p_quantidade, v_preco, v_cor);

  UPDATE public.fertex_produtos SET estoque = estoque - p_quantidade WHERE id = v_prod.id;

  RETURN v_pedido;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_registrar_venda(uuid, int, text, numeric, text) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_registrar_venda(uuid, int, text, numeric, text) TO authenticated;
--> statement-breakpoint
-- Listas de pedidos trazem a cor de cada item
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
          'quantidade', i.quantidade, 'preco_unitario', i.preco_unitario, 'unidade', i.unidade, 'cor', i.cor) ORDER BY pr.nome, i.cor)
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
-- Vendas ganham a coluna cor (retorno mudou: recriar)
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
