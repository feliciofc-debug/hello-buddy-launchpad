DROP POLICY IF EXISTS "Anon can read pj_lista_membros" ON public.pj_lista_membros;
REVOKE SELECT ON public.pj_lista_membros FROM anon;