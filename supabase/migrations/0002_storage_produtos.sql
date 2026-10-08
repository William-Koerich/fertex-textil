-- Bucket público (leitura) para as fotos dos produtos. Limite de 5 MB e apenas imagens.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fertex-produtos', 'fertex-produtos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
--> statement-breakpoint
-- Cada vendedor só grava/altera/apaga arquivos dentro da pasta com o próprio id: {user_id}/arquivo.webp
CREATE POLICY "fertex_produtos_fotos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fertex-produtos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND exists (select 1 from public.fertex_profiles p where p.id = (select auth.uid()) and p.perfil = 'vendedor')
  );
--> statement-breakpoint
CREATE POLICY "fertex_produtos_fotos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'fertex-produtos' AND (storage.foldername(name))[1] = (select auth.uid())::text)
  WITH CHECK (bucket_id = 'fertex-produtos' AND (storage.foldername(name))[1] = (select auth.uid())::text);
--> statement-breakpoint
CREATE POLICY "fertex_produtos_fotos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fertex-produtos' AND (storage.foldername(name))[1] = (select auth.uid())::text);
--> statement-breakpoint
-- Necessária para o upsert/remoção via API (a leitura pública das imagens usa a URL pública do bucket)
CREATE POLICY "fertex_produtos_fotos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fertex-produtos' AND (storage.foldername(name))[1] = (select auth.uid())::text);
