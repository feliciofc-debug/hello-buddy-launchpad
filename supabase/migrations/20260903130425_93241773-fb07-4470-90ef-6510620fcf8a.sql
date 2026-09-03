ALTER TABLE public.video_motion_jobs
  ADD COLUMN IF NOT EXISTS trilha_url TEXT,
  ADD COLUMN IF NOT EXISTS trilha_volume NUMERIC(4,3) NOT NULL DEFAULT 0.28;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_motion_jobs TO authenticated;
GRANT ALL ON public.video_motion_jobs TO service_role;

DROP POLICY IF EXISTS "Usuário autenticado lê trilhas próprias e globais" ON storage.objects;
CREATE POLICY "Usuário autenticado lê trilhas próprias e globais"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'trilhas-audio'
  AND (name LIKE 'global/%' OR name LIKE (auth.uid()::text || '/%'))
);

DROP POLICY IF EXISTS "Usuário envia trilhas próprias" ON storage.objects;
CREATE POLICY "Usuário envia trilhas próprias"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trilhas-audio'
  AND name LIKE (auth.uid()::text || '/%')
);

DROP POLICY IF EXISTS "Usuário atualiza trilhas próprias" ON storage.objects;
CREATE POLICY "Usuário atualiza trilhas próprias"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trilhas-audio'
  AND name LIKE (auth.uid()::text || '/%')
)
WITH CHECK (
  bucket_id = 'trilhas-audio'
  AND name LIKE (auth.uid()::text || '/%')
);

DROP POLICY IF EXISTS "Usuário remove trilhas próprias" ON storage.objects;
CREATE POLICY "Usuário remove trilhas próprias"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trilhas-audio'
  AND name LIKE (auth.uid()::text || '/%')
);