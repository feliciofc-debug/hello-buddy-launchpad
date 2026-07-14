ALTER TABLE public.whatsapp_cloud_agent_config
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS owner_name  text;

COMMENT ON COLUMN public.whatsapp_cloud_agent_config.owner_phone IS
  'Telefone (E.164 sem +) do dono deste tenant. Se o inbound bater com este número, o agente trata como dono. Isolamento por tenant.';
COMMENT ON COLUMN public.whatsapp_cloud_agent_config.owner_name IS
  'Nome do dono do tenant, usado no bloco de contexto do agente.';