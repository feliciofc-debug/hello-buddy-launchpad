-- Create carousels storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('carousels', 'carousels', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Carousel images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'carousels');

-- Authenticated users can upload
CREATE POLICY "Users can upload carousel images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'carousels');

-- Authenticated users can update/overwrite
CREATE POLICY "Users can update carousel images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'carousels');

-- Authenticated users can delete their own
CREATE POLICY "Users can delete carousel images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'carousels');