-- empresas
DROP POLICY IF EXISTS "Anyone can view empresas" ON public.empresas;
DROP POLICY IF EXISTS "System can manage empresas" ON public.empresas;
CREATE POLICY "Service manages empresas" ON public.empresas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated reads empresas" ON public.empresas FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.empresas FROM anon;
GRANT SELECT ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;

-- lead_atribuicoes
DROP POLICY IF EXISTS "Usuários podem ver atribuições" ON public.lead_atribuicoes;
CREATE POLICY "Owner reads lead_atribuicoes" ON public.lead_atribuicoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.vendedores v WHERE v.id = lead_atribuicoes.vendedor_id AND v.user_id = auth.uid()
  ));

-- vendedor_metas
DROP POLICY IF EXISTS "Usuários podem ver metas" ON public.vendedor_metas;
CREATE POLICY "Owner reads vendedor_metas" ON public.vendedor_metas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.vendedores v WHERE v.id = vendedor_metas.vendedor_id AND v.user_id = auth.uid()
  ));