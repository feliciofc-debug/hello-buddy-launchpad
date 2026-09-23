ALTER TABLE public.social_posts_queue
  ADD COLUMN IF NOT EXISTS instagram_creation_id text,
  ADD COLUMN IF NOT EXISTS instagram_container_status text;

COMMENT ON COLUMN public.social_posts_queue.instagram_creation_id IS
  'Container Instagram preservado após timeout para retry idempotente de media_publish.';

COMMENT ON COLUMN public.social_posts_queue.instagram_container_status IS
  'Último status_code observado no polling do container Instagram.';
