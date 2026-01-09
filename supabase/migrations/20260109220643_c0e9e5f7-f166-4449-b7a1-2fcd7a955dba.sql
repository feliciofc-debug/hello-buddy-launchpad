-- Tabela para log de prospecção opt-in
CREATE TABLE IF NOT EXISTS public.prospecao_optin_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  cadastro_id UUID REFERENCES public.cadastros(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  mensagem_enviada TEXT,
  wuzapi_response JSONB,
  user_id UUID,
  enviado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_prospecao_optin_log_phone ON public.prospecao_optin_log(phone);
CREATE INDEX IF NOT EXISTS idx_prospecao_optin_log_enviado_em ON public.prospecao_optin_log(enviado_em);
CREATE INDEX IF NOT EXISTS idx_prospecao_optin_log_status ON public.prospecao_optin_log(status);

-- RLS
ALTER TABLE public.prospecao_optin_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Afiliados podem ver seus logs de prospecção"
ON public.prospecao_optin_log
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode inserir logs de prospecção"
ON public.prospecao_optin_log
FOR INSERT
WITH CHECK (true);

-- Comentário
COMMENT ON TABLE public.prospecao_optin_log IS 'Log de envios de prospecção para contatos opt-in via Pietro Eugenio';