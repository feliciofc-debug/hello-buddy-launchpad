ALTER TABLE public.whatsapp_cloud_agent_config
ADD COLUMN IF NOT EXISTS agent_mode text NOT NULL DEFAULT 'whitelabel';

ALTER TABLE public.whatsapp_cloud_agent_config
DROP CONSTRAINT IF EXISTS whatsapp_cloud_agent_config_agent_mode_check;

ALTER TABLE public.whatsapp_cloud_agent_config
ADD CONSTRAINT whatsapp_cloud_agent_config_agent_mode_check
CHECK (agent_mode IN ('whitelabel', 'amz'));