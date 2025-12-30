-- Criar bucket para imagens de produtos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'produto-imagens', 
  'produto-imagens', 
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir leitura pública
CREATE POLICY "Imagens de produtos são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'produto-imagens');

-- Política para permitir upload via service role (edge functions)
CREATE POLICY "Service role pode fazer upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'produto-imagens');

-- Política para permitir delete via service role
CREATE POLICY "Service role pode deletar"
ON storage.objects FOR DELETE
USING (bucket_id = 'produto-imagens');