ALTER TABLE public.whatsapp_cloud_agent_config
  ADD COLUMN IF NOT EXISTS motion_video_daily_limit integer DEFAULT 5;

ALTER TABLE public.whatsapp_cloud_agent_config
  DROP CONSTRAINT IF EXISTS whatsapp_cloud_agent_config_motion_video_daily_limit_check;
ALTER TABLE public.whatsapp_cloud_agent_config
  ADD CONSTRAINT whatsapp_cloud_agent_config_motion_video_daily_limit_check
  CHECK (motion_video_daily_limit IS NULL OR motion_video_daily_limit >= 0);

-- O tenant dono usa o ambiente para testes e operação interna. NULL representa
-- ausência de cota diária; fila ativa e anti-duplicidade continuam valendo.
UPDATE public.whatsapp_cloud_agent_config
SET motion_video_daily_limit = NULL
WHERE user_id = '561e0ccc-3eda-4dc1-a315-c86a51623fc3';

COMMENT ON COLUMN public.whatsapp_cloud_agent_config.motion_video_daily_limit IS
  'Cota diária de vídeos motion por tenant. Default 5; NULL significa ilimitado.';
