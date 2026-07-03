-- Políticas de acesso para o bucket midias-whatsapp
-- Estrutura de pastas: {user_id}/{tipo}/{arquivo}

CREATE POLICY "Users read own midias-whatsapp files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'midias-whatsapp' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users upload own midias-whatsapp files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'midias-whatsapp' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own midias-whatsapp files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'midias-whatsapp' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own midias-whatsapp files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'midias-whatsapp' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );