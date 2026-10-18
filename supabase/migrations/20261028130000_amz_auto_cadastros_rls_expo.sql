-- Alinha RLS de amz_auto_cadastros com admin_criar_cliente (role admin ou expo@)

REVOKE ALL ON public.amz_auto_cadastros FROM anon;

DROP POLICY IF EXISTS amz_auto_cadastros_admin_select ON public.amz_auto_cadastros;
DROP POLICY IF EXISTS amz_auto_cadastros_admin_update ON public.amz_auto_cadastros;

CREATE POLICY amz_auto_cadastros_admin_select
  ON public.amz_auto_cadastros
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'expo@atombrasildigital.com'
  );

CREATE POLICY amz_auto_cadastros_admin_update
  ON public.amz_auto_cadastros
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'expo@atombrasildigital.com'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'expo@atombrasildigital.com'
  );

-- Rollback:
-- REVOKE ALL ON public.amz_auto_cadastros FROM anon;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.amz_auto_cadastros TO anon;
-- (recriar policies antigas só com has_role se necessário)
