-- Finaliza a compra do usuário logado de forma transacional.
-- Entrada: [{ "produto_id": "uuid", "quantidade": 2 }, ...]
-- 1. trava as linhas dos produtos (FOR UPDATE, em ordem de id para evitar deadlock);
-- 2. valida disponibilidade e estoque;
-- 3. cria o pedido (status concluido) e os itens com o preço atual do banco (nunca o do cliente);
-- 4. baixa o estoque.
-- Qualquer erro desfaz tudo. Retorna o id do pedido.
CREATE OR REPLACE FUNCTION public.fertex_finalizar_compra(p_itens jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pedido uuid;
  v_total numeric(12, 2) := 0;
  r record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para finalizar a compra.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fertex_profiles WHERE id = v_uid AND perfil = 'comprador') THEN
    RAISE EXCEPTION 'Apenas compradores podem finalizar compras.';
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

  -- Agrupa por produto (o mesmo produto pode vir repetido)
  CREATE TEMP TABLE fertex_tmp_itens ON COMMIT DROP AS
    SELECT (e ->> 'produto_id')::uuid AS produto_id, sum((e ->> 'quantidade')::int)::int AS quantidade
    FROM jsonb_array_elements(p_itens) e
    GROUP BY 1;

  -- Trava os produtos envolvidos até o fim da transação
  PERFORM 1 FROM public.fertex_produtos p
  WHERE p.id IN (SELECT produto_id FROM fertex_tmp_itens)
  ORDER BY p.id
  FOR UPDATE;

  -- Valida cada item
  FOR r IN
    SELECT i.produto_id, i.quantidade, p.nome, p.preco, p.estoque, p.ativo
    FROM fertex_tmp_itens i
    LEFT JOIN public.fertex_produtos p ON p.id = i.produto_id
  LOOP
    IF r.nome IS NULL OR NOT r.ativo THEN
      RAISE EXCEPTION 'Um produto do seu carrinho não está mais disponível%.',
        coalesce(' ("' || r.nome || '")', '')
        USING DETAIL = r.produto_id::text, HINT = 'indisponivel';
    END IF;
    IF r.estoque < r.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, no carrinho %.', r.nome, r.estoque, r.quantidade
        USING DETAIL = r.produto_id::text, HINT = 'estoque';
    END IF;
    v_total := v_total + r.preco * r.quantidade;
  END LOOP;

  INSERT INTO public.fertex_pedidos (comprador_id, total, status)
  VALUES (v_uid, v_total, 'concluido')
  RETURNING id INTO v_pedido;

  INSERT INTO public.fertex_itens_pedido (pedido_id, produto_id, vendedor_id, quantidade, preco_unitario)
  SELECT v_pedido, p.id, p.vendedor_id, i.quantidade, p.preco
  FROM fertex_tmp_itens i
  JOIN public.fertex_produtos p ON p.id = i.produto_id;

  UPDATE public.fertex_produtos p
  SET estoque = p.estoque - i.quantidade
  FROM fertex_tmp_itens i
  WHERE p.id = i.produto_id;

  DROP TABLE fertex_tmp_itens;

  RETURN v_pedido;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_finalizar_compra(jsonb) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_finalizar_compra(jsonb) TO authenticated;
