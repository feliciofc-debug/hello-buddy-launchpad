-- afiliado_listas_categoria
DROP POLICY IF EXISTS "Listas públicas para leitura" ON public.afiliado_listas_categoria;
DROP POLICY IF EXISTS "Admins podem gerenciar listas" ON public.afiliado_listas_categoria;
CREATE POLICY "Owner manages own listas" ON public.afiliado_listas_categoria
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- afiliado_lista_membros
DROP POLICY IF EXISTS "Membros visíveis para autenticados" ON public.afiliado_lista_membros;
DROP POLICY IF EXISTS "Inserir membros sem autenticação" ON public.afiliado_lista_membros;
CREATE POLICY "Owner reads own lista membros" ON public.afiliado_lista_membros
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.afiliado_listas_categoria l
    WHERE l.id = afiliado_lista_membros.lista_id AND l.user_id = auth.uid()
  ));
CREATE POLICY "Owner writes own lista membros" ON public.afiliado_lista_membros
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.afiliado_listas_categoria l
    WHERE l.id = afiliado_lista_membros.lista_id AND l.user_id = auth.uid()
  ));
CREATE POLICY "Owner deletes own lista membros" ON public.afiliado_lista_membros
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.afiliado_listas_categoria l
    WHERE l.id = afiliado_lista_membros.lista_id AND l.user_id = auth.uid()
  ));

-- wuzapi_instances (legado, tokens sensíveis)
DROP POLICY IF EXISTS "System can manage instances" ON public.wuzapi_instances;
DROP POLICY IF EXISTS "Users can view their own instance" ON public.wuzapi_instances;
CREATE POLICY "Users view only assigned instance" ON public.wuzapi_instances
  FOR SELECT TO authenticated
  USING (auth.uid() = assigned_to_user);

REVOKE ALL ON public.afiliado_listas_categoria FROM anon;
REVOKE ALL ON public.afiliado_lista_membros FROM anon;
REVOKE ALL ON public.wuzapi_instances FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.afiliado_listas_categoria TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.afiliado_lista_membros TO authenticated;
GRANT SELECT ON public.wuzapi_instances TO authenticated;
GRANT ALL ON public.afiliado_listas_categoria TO service_role;
GRANT ALL ON public.afiliado_lista_membros TO service_role;
GRANT ALL ON public.wuzapi_instances TO service_role;