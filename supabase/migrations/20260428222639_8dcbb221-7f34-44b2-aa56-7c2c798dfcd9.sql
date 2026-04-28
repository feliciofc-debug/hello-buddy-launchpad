-- Tabela de conversas do Pietro Cobrador
CREATE TABLE public.cobranca_conversas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  customer_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cobranca_conversas_phone_created ON public.cobranca_conversas (phone, created_at DESC);

ALTER TABLE public.cobranca_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access cobranca_conversas"
ON public.cobranca_conversas
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view cobranca_conversas"
ON public.cobranca_conversas
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Dedup de mensagens entrantes do webhook de cobrança
CREATE TABLE public.cobranca_webhook_dedup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cobranca_webhook_dedup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access cobranca_webhook_dedup"
ON public.cobranca_webhook_dedup
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);