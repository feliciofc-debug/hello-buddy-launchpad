CREATE TABLE public.jarvis_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  telefone TEXT NOT NULL,
  nome TEXT,
  empresa TEXT,
  ramo TEXT,
  interesse TEXT,
  origem TEXT NOT NULL DEFAULT 'whatsapp',
  notificado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX jarvis_leads_user_telefone_key ON public.jarvis_leads (user_id, telefone);
CREATE INDEX jarvis_leads_user_created_idx ON public.jarvis_leads (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_leads TO authenticated;
GRANT ALL ON public.jarvis_leads TO service_role;

ALTER TABLE public.jarvis_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own jarvis leads"
ON public.jarvis_leads FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_jarvis_leads_updated_at
BEFORE UPDATE ON public.jarvis_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();