CREATE TABLE public.tenant_ebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  arquivo_url text,
  arquivo_nome text,
  texto_convite text,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tenant_ebooks_user_id_key ON public.tenant_ebooks(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_ebooks TO authenticated;
GRANT ALL ON public.tenant_ebooks TO service_role;

ALTER TABLE public.tenant_ebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_ebooks_own" ON public.tenant_ebooks
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tenant_ebooks_service" ON public.tenant_ebooks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER tenant_ebooks_updated_at
  BEFORE UPDATE ON public.tenant_ebooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tenant_ebook_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ebook_id uuid REFERENCES public.tenant_ebooks(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  status text NOT NULL DEFAULT 'entregue',
  origem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tenant_ebook_entregas_user_tel_key
  ON public.tenant_ebook_entregas(user_id, telefone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_ebook_entregas TO authenticated;
GRANT ALL ON public.tenant_ebook_entregas TO service_role;

ALTER TABLE public.tenant_ebook_entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_ebook_entregas_own" ON public.tenant_ebook_entregas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tenant_ebook_entregas_service" ON public.tenant_ebook_entregas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER tenant_ebook_entregas_updated_at
  BEFORE UPDATE ON public.tenant_ebook_entregas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "ebooks_tenant_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ebooks' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ebooks_tenant_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ebooks' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ebooks_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ebooks' AND (storage.foldername(name))[1] = auth.uid()::text);