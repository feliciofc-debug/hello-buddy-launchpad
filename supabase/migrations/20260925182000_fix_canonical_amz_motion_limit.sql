-- Corrige ambientes que aplicaram a primeira versão da migration de cota com
-- o UUID legado da conta Lovable.
UPDATE public.whatsapp_cloud_agent_config
SET motion_video_daily_limit = 5
WHERE user_id = 'b7af0118-c506-4f87-8ac3-a0a11fd621fe'
  AND motion_video_daily_limit IS NULL;

UPDATE public.whatsapp_cloud_agent_config
SET motion_video_daily_limit = NULL
WHERE user_id = '561e0ccc-3eda-4dc1-a315-c86a51623fc3';
