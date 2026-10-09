-- Pedido pelo WhatsApp passa a respeitar a quantidade mínima por pedido de cada produto
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
    SELECT i.produto_id, i.quantidade, p.nome, p.preco, p.estoque, p.ativo AND p.excluido_em IS NULL AS ativo, p.vendedor_id, p.unidade, p.quantidade_minima
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
    IF r.quantidade_minima IS NOT NULL AND r.quantidade < r.quantidade_minima THEN
      RAISE EXCEPTION 'O pedido mínimo de "%" é de % (no carrinho: %).', r.nome, r.quantidade_minima, r.quantidade
        USING DETAIL = r.produto_id::text, HINT = 'minimo';
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
        SELECT jsonb_agg(jsonb_build_object('nome', nome, 'quantidade', quantidade, 'preco_unitario', preco, 'unidade', unidade) ORDER BY nome)
        FROM fertex_tmp_pedido WHERE vendedor_id = v_vend.id
      )
    );
  END LOOP;

  DROP TABLE fertex_tmp_pedido;
  RETURN v_resultado;
END;
$$;
--> statement-breakpoint
-- O checkout direto (sem WhatsApp) não é mais usado pela tela; bloqueado para não contornar o fluxo
-- de pedido pendente nem a quantidade mínima
REVOKE EXECUTE ON FUNCTION public.fertex_finalizar_compra(jsonb) FROM authenticated;
