-- O WhatsApp do vendedor passa a ser público: aparece na loja, no botão flutuante e nas imagens de
-- compartilhamento, para o cliente entrar em contato sem precisar criar conta.
-- (O retorno da função mudou, então ela é recriada.)
DROP FUNCTION IF EXISTS public.fertex_vendedores_publicos();
--> statement-breakpoint
CREATE FUNCTION public.fertex_vendedores_publicos()
RETURNS TABLE (id uuid, nome text, whatsapp text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.nome, p.whatsapp
  FROM public.fertex_profiles p
  WHERE p.perfil = 'vendedor'
    AND EXISTS (SELECT 1 FROM public.fertex_produtos pr WHERE pr.vendedor_id = p.id AND pr.ativo AND pr.excluido_em IS NULL);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_vendedores_publicos() FROM public;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.fertex_vendedores_publicos() TO anon, authenticated;
