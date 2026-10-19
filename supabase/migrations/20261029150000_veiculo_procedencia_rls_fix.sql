-- Consultas de procedência: somente service_role escreve (painel/WhatsApp via edge).

DROP POLICY IF EXISTS veiculo_procedencia_consulta_insert ON public.veiculo_procedencia_consulta;
DROP POLICY IF EXISTS veiculo_procedencia_consulta_update ON public.veiculo_procedencia_consulta;
DROP POLICY IF EXISTS veiculo_procedencia_consulta_delete ON public.veiculo_procedencia_consulta;

REVOKE INSERT, UPDATE, DELETE ON public.veiculo_procedencia_consulta FROM authenticated;
