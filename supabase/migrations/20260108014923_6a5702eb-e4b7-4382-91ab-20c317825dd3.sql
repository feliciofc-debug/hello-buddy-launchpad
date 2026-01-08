-- Tabela para deduplicação de webhooks (evitar loop de respostas)
CREATE TABLE public.afiliado_webhook_dedup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL,
  instance_name TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index único para garantir que não processe o mesmo message_id + instance duas vezes
CREATE UNIQUE INDEX idx_afiliado_webhook_dedup_unique ON public.afiliado_webhook_dedup (message_id, instance_name);

-- Index para limpeza de registros antigos (performance)
CREATE INDEX idx_afiliado_webhook_dedup_created ON public.afiliado_webhook_dedup (created_at);

-- RLS desativado (tabela interna do sistema, usada apenas pelo webhook)
ALTER TABLE public.afiliado_webhook_dedup ENABLE ROW LEVEL SECURITY;

-- Policy: apenas service_role pode inserir/ler (webhooks rodam com service_role)
CREATE POLICY "Service role only" ON public.afiliado_webhook_dedup
  FOR ALL USING (true) WITH CHECK (true);

-- Função para limpar registros antigos (mais de 24h)
CREATE OR REPLACE FUNCTION public.limpar_webhook_dedup_antigos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM afiliado_webhook_dedup
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;