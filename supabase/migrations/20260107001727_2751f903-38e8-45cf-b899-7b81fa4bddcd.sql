-- Criar política para permitir upload de imagens WhatsApp na pasta whatsapp-images/
CREATE POLICY "Users can upload whatsapp images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'produtos' 
  AND auth.uid()::text = (storage.foldername(name))[2]
  AND (storage.foldername(name))[1] = 'whatsapp-images'
);

-- Criar política para usuários lerem suas próprias imagens
CREATE POLICY "Users can read own whatsapp images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'produtos' 
  AND auth.uid()::text = (storage.foldername(name))[2]
  AND (storage.foldername(name))[1] = 'whatsapp-images'
);

-- Garantir que o bucket é público para leitura (Wuzapi precisa acessar)
CREATE POLICY "Anyone can read whatsapp images publicly"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'produtos' 
  AND (storage.foldername(name))[1] = 'whatsapp-images'
);