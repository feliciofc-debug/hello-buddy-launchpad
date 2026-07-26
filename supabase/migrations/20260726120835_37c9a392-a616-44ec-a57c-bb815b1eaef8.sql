BEGIN;

ALTER TABLE public.pj_clientes_config
  ADD COLUMN IF NOT EXISTS max_envios_dia_numero integer NOT NULL DEFAULT 300;

ALTER TABLE public.historico_envios
  ADD COLUMN IF NOT EXISTS envio_dia_sp date;

CREATE INDEX IF NOT EXISTS idx_historico_envios_user_dia_sp
  ON public.historico_envios (user_id, envio_dia_sp)
  WHERE envio_dia_sp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_historico_envios_camp_dia_sp
  ON public.historico_envios (campanha_id, envio_dia_sp)
  WHERE envio_dia_sp IS NOT NULL;

COMMIT;