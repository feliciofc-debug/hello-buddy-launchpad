-- G90-2.1: status do resumo diário e controle anti-spam

ALTER TABLE public.gestao_giro_config
  ADD COLUMN IF NOT EXISTS resumo_ultimo_status text NULL CHECK (
    resumo_ultimo_status IS NULL OR resumo_ultimo_status IN (
      'enviado', 'parcial', 'bloqueado_24h', 'falha'
    )
  ),
  ADD COLUMN IF NOT EXISTS resumo_tentativas_tecnico integer NOT NULL DEFAULT 0 CHECK (
    resumo_tentativas_tecnico >= 0 AND resumo_tentativas_tecnico <= 3
  ),
  ADD COLUMN IF NOT EXISTS resumo_phones_ok text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.gestao_giro_config.resumo_ultimo_status IS
  'Resultado da última tentativa do resumo diário.';
COMMENT ON COLUMN public.gestao_giro_config.resumo_tentativas_tecnico IS
  'Retentativas por falha técnica total no mesmo dia (máx. 2 extras).';
COMMENT ON COLUMN public.gestao_giro_config.resumo_phones_ok IS
  'Telefones que já receberam o resumo no dia (evita reenvio a gestores).';
