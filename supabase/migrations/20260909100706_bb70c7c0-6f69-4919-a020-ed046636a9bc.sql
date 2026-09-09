REVOKE EXECUTE ON FUNCTION public.claim_site_render_job(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_site_render_job(INT) TO service_role;