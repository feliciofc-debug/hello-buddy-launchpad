
-- Create videos storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to videos bucket
CREATE POLICY "authenticated_upload_videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos');

-- Allow public read access to videos bucket
CREATE POLICY "public_read_videos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'videos');
