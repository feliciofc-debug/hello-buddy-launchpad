
-- 1. Adicionar processing_started_at na fila
ALTER TABLE public.whatsapp_cloud_inbound_queue
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_cloud_queue_status_created
  ON public.whatsapp_cloud_inbound_queue (status, created_at);

CREATE INDEX IF NOT EXISTS idx_wa_cloud_queue_processing_started
  ON public.whatsapp_cloud_inbound_queue (processing_started_at)
  WHERE status = 'processing';

-- 2. whatsapp_cloud_conversations
CREATE TABLE IF NOT EXISTS public.whatsapp_cloud_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_number text NOT NULL,
  contact_name text,
  status text NOT NULL DEFAULT 'active',
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_cloud_conversations TO authenticated;
GRANT ALL ON public.whatsapp_cloud_conversations TO service_role;

ALTER TABLE public.whatsapp_cloud_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_cloud_conv_owner_select" ON public.whatsapp_cloud_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wa_cloud_conv_owner_insert" ON public.whatsapp_cloud_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wa_cloud_conv_owner_update" ON public.whatsapp_cloud_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wa_cloud_conv_owner_delete" ON public.whatsapp_cloud_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_cloud_conv_user_status
  ON public.whatsapp_cloud_conversations (user_id, status);

CREATE TRIGGER trg_wa_cloud_conv_updated_at
  BEFORE UPDATE ON public.whatsapp_cloud_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. whatsapp_cloud_messages
CREATE TABLE IF NOT EXISTS public.whatsapp_cloud_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_cloud_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  direction text NOT NULL,
  sender text NOT NULL,
  content text,
  message_type text NOT NULL DEFAULT 'text',
  wamid text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_cloud_messages TO authenticated;
GRANT ALL ON public.whatsapp_cloud_messages TO service_role;

ALTER TABLE public.whatsapp_cloud_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_cloud_msg_owner_select" ON public.whatsapp_cloud_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wa_cloud_msg_owner_insert" ON public.whatsapp_cloud_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_cloud_msg_conv ON public.whatsapp_cloud_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_cloud_msg_user ON public.whatsapp_cloud_messages (user_id);

-- 4. ai_messages_quota
CREATE TABLE IF NOT EXISTS public.ai_messages_quota (
  user_id uuid PRIMARY KEY,
  monthly_limit integer NOT NULL DEFAULT 1000,
  used_count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_messages_quota TO authenticated;
GRANT ALL ON public.ai_messages_quota TO service_role;

ALTER TABLE public.ai_messages_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_quota_owner_select" ON public.ai_messages_quota
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_ai_quota_updated_at
  BEFORE UPDATE ON public.ai_messages_quota
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Trigger: dispara o processor via pg_net no AFTER INSERT
CREATE OR REPLACE FUNCTION public.trigger_whatsapp_cloud_processor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  supabase_url text := 'https://jibpvpqgplmahjhswiza.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYnB2cHFncGxtYWhqaHN3aXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODA0ODcsImV4cCI6MjA3NjE1NjQ4N30.raNfZtKkNUZBHiAA6yobri0YoWZt_Ioq10qMC9hfNrc';
BEGIN
  IF NEW.status = 'received' THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/whatsapp-cloud-inbound-processor',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'apikey', anon_key
      ),
      body := jsonb_build_object('queue_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Não bloqueia o insert se pg_net falhar; cron de backup pega.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_cloud_queue_dispatch ON public.whatsapp_cloud_inbound_queue;
CREATE TRIGGER trg_wa_cloud_queue_dispatch
  AFTER INSERT ON public.whatsapp_cloud_inbound_queue
  FOR EACH ROW EXECUTE FUNCTION public.trigger_whatsapp_cloud_processor();

-- 6. Função de resgate de órfãos (cron chama a cada 2 min)
CREATE OR REPLACE FUNCTION public.resgatar_whatsapp_cloud_orfaos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  supabase_url text := 'https://jibpvpqgplmahjhswiza.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYnB2cHFncGxtYWhqaHN3aXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODA0ODcsImV4cCI6MjA3NjE1NjQ4N30.raNfZtKkNUZBHiAA6yobri0YoWZt_Ioq10qMC9hfNrc';
  v_received_count int := 0;
  v_processing_reset int := 0;
  v_max_attempts int := 0;
  r record;
BEGIN
  -- 6a. Processing órfão (> 5min): se attempts < 3 volta pra received, senão failed
  WITH orphans AS (
    UPDATE public.whatsapp_cloud_inbound_queue q
    SET 
      status = CASE WHEN q.attempts >= 3 THEN 'failed' ELSE 'received' END,
      error = CASE WHEN q.attempts >= 3 THEN 'max_attempts_exceeded' ELSE NULL END,
      processing_started_at = NULL
    WHERE q.status = 'processing'
      AND q.processing_started_at < now() - interval '5 minutes'
    RETURNING id, status
  )
  SELECT 
    count(*) FILTER (WHERE status = 'received'),
    count(*) FILTER (WHERE status = 'failed')
  INTO v_processing_reset, v_max_attempts
  FROM orphans;

  -- 6b. Received que escapou do trigger (> 1min): re-dispara via pg_net
  FOR r IN
    SELECT id FROM public.whatsapp_cloud_inbound_queue
    WHERE status = 'received'
      AND created_at < now() - interval '1 minute'
    ORDER BY created_at ASC
    LIMIT 50
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/whatsapp-cloud-inbound-processor',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key,
          'apikey', anon_key
        ),
        body := jsonb_build_object('queue_id', r.id)
      );
      v_received_count := v_received_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'received_redispatched', v_received_count,
    'processing_reset_to_received', v_processing_reset,
    'processing_marked_failed', v_max_attempts
  );
END;
$$;
