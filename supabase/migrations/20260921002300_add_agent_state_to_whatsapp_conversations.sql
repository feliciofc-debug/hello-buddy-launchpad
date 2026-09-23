BEGIN;

ALTER TABLE public.whatsapp_cloud_conversations
  ADD COLUMN IF NOT EXISTS agent_state JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.whatsapp_cloud_conversations.agent_state IS
  'Estado persistente e limitado do agente por conversa: ultima midia, rascunhos e decisoes.';

COMMIT;
