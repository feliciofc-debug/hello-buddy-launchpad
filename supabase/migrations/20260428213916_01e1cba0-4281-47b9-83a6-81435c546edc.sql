CREATE TABLE public.cobranca_envios_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('D-5','D-2','D-0','D+1','D+5')),
  mensagem_enviada text NOT NULL,
  whatsapp_destino text NOT NULL,
  status text NOT NULL DEFAULT 'enviado'
    CHECK (status IN ('enviado','entregue','lido','erro')),
  wuzapi_message_id text,
  erro_detalhe text,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cobranca_envios_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access cobranca_envios_log"
  ON public.cobranca_envios_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_cobranca_envios_log_updated_at
  BEFORE UPDATE ON public.cobranca_envios_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cobranca_envios_log_cliente
  ON public.cobranca_envios_log(cliente_id, enviado_em DESC);

CREATE INDEX idx_cobranca_envios_log_tipo_data
  ON public.cobranca_envios_log(tipo, enviado_em DESC);