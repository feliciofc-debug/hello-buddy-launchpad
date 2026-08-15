-- 1. vendedor_metas: remover política permissiva e escopar escrita ao dono do vendedor
DROP POLICY IF EXISTS "Usuários podem gerenciar metas" ON public.vendedor_metas;

CREATE POLICY "Owner writes vendedor_metas"
ON public.vendedor_metas
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.vendedores v
    WHERE v.id = vendedor_metas.vendedor_id AND v.user_id = auth.uid()
  )
);

CREATE POLICY "Owner updates vendedor_metas"
ON public.vendedor_metas
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.vendedores v
    WHERE v.id = vendedor_metas.vendedor_id AND v.user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.vendedores v
    WHERE v.id = vendedor_metas.vendedor_id AND v.user_id = auth.uid()
  )
);

CREATE POLICY "Owner deletes vendedor_metas"
ON public.vendedor_metas
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.vendedores v
    WHERE v.id = vendedor_metas.vendedor_id AND v.user_id = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedor_metas TO authenticated;
GRANT ALL ON public.vendedor_metas TO service_role;

-- 2. lead_atribuicoes: insert apenas para vendedor do próprio usuário
DROP POLICY IF EXISTS "Usuários podem criar atribuições" ON public.lead_atribuicoes;

CREATE POLICY "Owner creates lead_atribuicoes"
ON public.lead_atribuicoes
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.vendedores v
    WHERE v.id = lead_atribuicoes.vendedor_id AND v.user_id = auth.uid()
  )
);

GRANT SELECT, INSERT ON public.lead_atribuicoes TO authenticated;
GRANT ALL ON public.lead_atribuicoes TO service_role;

-- 3. backup_logs: leitura apenas para admin
DROP POLICY IF EXISTS "Admins podem ver logs de backup" ON public.backup_logs;

CREATE POLICY "Admins read backup_logs"
ON public.backup_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.backup_logs TO authenticated;
GRANT ALL ON public.backup_logs TO service_role;