-- 1) Coluna na profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_reel_url TEXT;

-- 2) Bucket user-logos (público, 5MB, PNG/JPEG)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-logos',
  'user-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- 3) Policies do bucket
DROP POLICY IF EXISTS "User logos are publicly accessible" ON storage.objects;
CREATE POLICY "User logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-logos');

DROP POLICY IF EXISTS "Users can upload their own logo" ON storage.objects;
CREATE POLICY "Users can upload their own logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their own logo" ON storage.objects;
CREATE POLICY "Users can update their own logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own logo" ON storage.objects;
CREATE POLICY "Users can delete their own logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);