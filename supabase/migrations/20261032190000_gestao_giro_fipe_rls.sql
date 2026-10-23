-- G90-1.1: referências oficiais (FIPE/Molicar) só via service role; manual pelo dono autenticado

DROP POLICY IF EXISTS veiculo_preco_referencia_own ON public.veiculo_preco_referencia;

CREATE POLICY veiculo_preco_referencia_select_own ON public.veiculo_preco_referencia
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY veiculo_preco_referencia_insert_manual ON public.veiculo_preco_referencia
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND fonte = 'manual');

CREATE POLICY veiculo_preco_referencia_update_manual ON public.veiculo_preco_referencia
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND fonte = 'manual')
  WITH CHECK (auth.uid() = user_id AND fonte = 'manual');

CREATE POLICY veiculo_preco_referencia_delete_manual ON public.veiculo_preco_referencia
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND fonte = 'manual');
