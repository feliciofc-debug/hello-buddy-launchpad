ALTER TABLE public.whatsapp_cloud_agent_config
  ADD COLUMN IF NOT EXISTS demo_test_phones text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.whatsapp_cloud_agent_config.demo_test_phones IS
  'Telefones de teste que permanecem como prospects e não consomem o limite da demonstração AMZ.';
