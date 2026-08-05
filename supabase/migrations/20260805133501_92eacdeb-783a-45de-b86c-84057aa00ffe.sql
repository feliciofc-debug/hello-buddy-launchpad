ALTER TABLE public.tenant_ebooks ADD COLUMN IF NOT EXISTS arquivo_path TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_ebooks_user_id_key ON public.tenant_ebooks (user_id);

-- Storage privado: isolamento estrito por tenant (primeira pasta = user_id).
DROP POLICY IF EXISTS "tenant_ebooks_select_own" ON storage.objects;
CREATE POLICY "tenant_ebooks_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tenant-ebooks' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "tenant_ebooks_insert_own" ON storage.objects;
CREATE POLICY "tenant_ebooks_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenant-ebooks' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "tenant_ebooks_update_own" ON storage.objects;
CREATE POLICY "tenant_ebooks_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tenant-ebooks' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'tenant-ebooks' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "tenant_ebooks_delete_own" ON storage.objects;
CREATE POLICY "tenant_ebooks_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tenant-ebooks' AND (storage.foldername(name))[1] = auth.uid()::text);