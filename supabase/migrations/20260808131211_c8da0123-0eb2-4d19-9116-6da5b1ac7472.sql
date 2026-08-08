CREATE TABLE public.tenant_logos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_logos TO authenticated;
GRANT ALL ON public.tenant_logos TO service_role;

ALTER TABLE public.tenant_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manages own logo" ON public.tenant_logos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX tenant_logos_user_ativa_idx ON public.tenant_logos (user_id) WHERE ativo;

CREATE TRIGGER update_tenant_logos_updated_at
  BEFORE UPDATE ON public.tenant_logos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Tenant reads own logo files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'tenant-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Tenant uploads own logo files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Tenant updates own logo files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'tenant-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'tenant-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Tenant deletes own logo files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tenant-logos' AND (storage.foldername(name))[1] = auth.uid()::text);