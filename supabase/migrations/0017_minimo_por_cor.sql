-- Pedido mínimo passa a valer para cada variação (cor) do produto; o estoque continua sendo do produto

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
    -- Pedido mínimo vale para cada variação (cada cor); sem cores, para o produto
    IF r.quantidade_minima IS NOT NULL AND r.quantidade < r.quantidade_minima THEN
      RAISE EXCEPTION 'O pedido mínimo de "%"% é de % (no carrinho: %).',
        r.nome, coalesce(' na cor ' || r.cor, ''), r.quantidade_minima, r.quantidade
        USING DETAIL = r.produto_id::text, HINT = 'minimo';
    END IF;
  END LOOP;

  -- O estoque é do produto: soma todas as cores
  FOR r IN
    SELECT produto_id, nome, estoque, sum(quantidade)::int AS total
    FROM fertex_tmp_pedido GROUP BY produto_id, nome, estoque
  LOOP
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
