-- Venda registrada manualmente pelo vendedor (balcão, WhatsApp, feira…).
-- Trava o produto, confere dono e estoque, cria o pedido (origem 'manual') e o item, e baixa o estoque.
-- p_preco_unitario: opcional; se nulo usa o preço atual do produto (permite registrar com desconto).
CREATE OR REPLACE FUNCTION public.fertex_registrar_venda(
  p_produto_id uuid,
  p_quantidade int,
  p_cliente_nome text DEFAULT NULL,
  p_preco_unitario numeric DEFAULT NULL
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
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.fertex_profiles WHERE id = v_uid AND perfil = 'vendedor') THEN
    RAISE EXCEPTION 'Apenas vendedores podem registrar vendas.';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade < 1 OR p_quantidade > 100000 THEN
    RAISE EXCEPTION 'Informe uma quantidade válida.';
  END IF;

  SELECT id, nome, preco, estoque, vendedor_id INTO v_prod
  FROM public.fertex_produtos WHERE id = p_produto_id
  FOR UPDATE;

  -- Produto inexistente ou de outro vendedor: mesma mensagem (não revela produtos alheios)
  IF v_prod.id IS NULL OR v_prod.vendedor_id <> v_uid THEN
    RAISE EXCEPTION 'Produto não encontrado.';
  END IF;

  IF v_prod.estoque < p_quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %.', v_prod.nome, v_prod.estoque
      USING DETAIL = v_prod.id::text, HINT = 'estoque';
  END IF;

  v_preco := coalesce(p_preco_unitario, v_prod.preco);
  IF v_preco < 0 OR v_preco > 9999999 THEN
    RAISE EXCEPTION 'Preço inválido.';
  END IF;

  INSERT INTO public.fertex_pedidos (comprador_id, total, status, origem, cliente_nome)
  VALUES (NULL, v_preco * p_quantidade, 'concluido', 'manual', nullif(left(trim(p_cliente_nome), 120), ''))
  RETURNING id INTO v_pedido;

  INSERT INTO public.fertex_itens_pedido (pedido_id, produto_id, vendedor_id, quantidade, preco_unitario)
  VALUES (v_pedido, v_prod.id, v_uid, p_quantidade, v_preco);

  UPDATE public.fertex_produtos SET estoque = estoque - p_quantidade WHERE id = v_prod.id;

  RETURN v_pedido;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_registrar_venda(uuid, int, text, numeric) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_registrar_venda(uuid, int, text, numeric) TO authenticated;
--> statement-breakpoint
-- A tela de vendas passa a incluir vendas diretas (sem comprador cadastrado) e a origem de cada venda.
-- O tipo de retorno mudou, então a função precisa ser recriada.
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
    pe.criado_em,
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
    AND (p_inicio IS NULL OR pe.criado_em >= (p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'))
    AND (p_fim IS NULL OR pe.criado_em < ((p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'))
    AND (p_produto_id IS NULL OR i.produto_id = p_produto_id)
  ORDER BY pe.criado_em DESC, pr.nome
  LIMIT 5000;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_vendas_vendedor(date, date, uuid) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_vendas_vendedor(date, date, uuid) TO authenticated;
