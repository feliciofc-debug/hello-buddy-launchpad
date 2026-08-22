CREATE TABLE public.lead_encaminhamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  telefone text NOT NULL,
  nome text,
  mensagem text,
  protocolo text,
  wamid_dono text,
  enviado_em timestamp with time zone NOT NULL DEFAULT now(),
  complemento_nome_enviado boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX lead_encaminhamentos_user_created_idx ON public.lead_encaminhamentos (user_id, created_at DESC);
CREATE INDEX lead_encaminhamentos_user_tel_idx ON public.lead_encaminhamentos (user_id, telefone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_encaminhamentos TO authenticated;
GRANT ALL ON public.lead_encaminhamentos TO service_role;

ALTER TABLE public.lead_encaminhamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own lead forwards"
ON public.lead_encaminhamentos
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_lead_encaminhamentos_updated_at
BEFORE UPDATE ON public.lead_encaminhamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();