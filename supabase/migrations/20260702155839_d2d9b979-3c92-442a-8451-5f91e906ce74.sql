
CREATE TABLE public.whatsapp_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_number TEXT NOT NULL,
  titulo TEXT NOT NULL,
  meeting_at TIMESTAMPTZ NOT NULL,
  next_notify_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_reminders TO authenticated;
GRANT ALL ON public.whatsapp_reminders TO service_role;
ALTER TABLE public.whatsapp_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_owner_all" ON public.whatsapp_reminders FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_reminders_due ON public.whatsapp_reminders(status, next_notify_at);

-- pg_cron a cada minuto
SELECT cron.schedule(
  'whatsapp-reminders-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/whatsapp-reminders-tick',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYnB2cHFncGxtYWhqaHN3aXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODA0ODcsImV4cCI6MjA3NjE1NjQ4N30.raNfZtKkNUZBHiAA6yobri0YoWZt_Ioq10qMC9hfNrc"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
