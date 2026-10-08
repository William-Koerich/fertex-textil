-- Vendas do vendedor logado (uma linha por item vendido), com data do pedido e nome do comprador.
-- O vendedor não tem acesso direto a fertex_pedidos/fertex_profiles de outros usuários; esta função
-- expõe apenas o necessário e SEMPRE filtra por vendedor_id = auth.uid().
-- Datas no fuso de Brasília; p_inicio e p_fim são inclusivos.
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
    co.nome,
    i.quantidade,
    i.preco_unitario,
    i.quantidade * i.preco_unitario
  FROM public.fertex_itens_pedido i
  JOIN public.fertex_pedidos pe ON pe.id = i.pedido_id
  JOIN public.fertex_produtos pr ON pr.id = i.produto_id
  JOIN public.fertex_profiles co ON co.id = pe.comprador_id
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
