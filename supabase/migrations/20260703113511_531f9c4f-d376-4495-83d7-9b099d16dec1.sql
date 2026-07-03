GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts_queue TO authenticated;
GRANT ALL ON public.social_posts_queue TO service_role;