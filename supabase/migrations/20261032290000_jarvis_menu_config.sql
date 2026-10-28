-- MENU-B3: rollout por loja do menu de serviços do Jarvis.
-- Nenhuma loja é ligada por esta migration.

CREATE TABLE IF NOT EXISTS public.jarvis_menu_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  vendedor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  recent_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.jarvis_menu_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.jarvis_menu_config FROM anon, authenticated;
GRANT SELECT ON public.jarvis_menu_config TO authenticated;
GRANT ALL ON public.jarvis_menu_config TO service_role;

DROP POLICY IF EXISTS jarvis_menu_config_owner_select
  ON public.jarvis_menu_config;
CREATE POLICY jarvis_menu_config_owner_select
  ON public.jarvis_menu_config
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.jarvis_menu_config IS
  'Flags de rollout do menu WhatsApp; escrita exclusiva do service_role.';
