-- Cria o perfil (fertex_profiles) automaticamente quando um usuário se cadastra pelo app.
-- O app envia { nome, fertex_perfil } em options.data no signUp. Usuários de outros apps
-- do mesmo projeto Supabase (sem fertex_perfil) são ignorados.
CREATE OR REPLACE FUNCTION public.fertex_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil text := new.raw_user_meta_data ->> 'fertex_perfil';
  v_nome text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1));
BEGIN
  IF v_perfil IN ('vendedor', 'comprador') THEN
    INSERT INTO public.fertex_profiles (id, nome, perfil)
    VALUES (new.id, v_nome, v_perfil::public.fertex_perfil)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fertex_handle_new_user() FROM public, anon, authenticated;
--> statement-breakpoint
DROP TRIGGER IF EXISTS fertex_on_auth_user_created ON auth.users;
--> statement-breakpoint
CREATE TRIGGER fertex_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fertex_handle_new_user();
--> statement-breakpoint
-- Tabelas do app só são acessíveis a usuários autenticados (as policies de RLS restringem o resto)
REVOKE ALL ON public.fertex_profiles, public.fertex_produtos, public.fertex_pedidos, public.fertex_itens_pedido FROM anon;
