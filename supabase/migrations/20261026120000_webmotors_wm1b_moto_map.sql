-- WM-1b: colunas de de/para para motos (DDL only)

ALTER TABLE public.webmotors_veiculo_map
  ADD COLUMN IF NOT EXISTS codigo_cor_secundaria numeric NULL,
  ADD COLUMN IF NOT EXISTS numero_cilindradas integer NULL,
  ADD COLUMN IF NOT EXISTS codigo_numero_marchas numeric NULL,
  ADD COLUMN IF NOT EXISTS codigo_tipo_refrigeracao numeric NULL,
  ADD COLUMN IF NOT EXISTS codigo_tipo_alimentacao numeric NULL,
  ADD COLUMN IF NOT EXISTS codigo_tipo_motor numeric NULL,
  ADD COLUMN IF NOT EXISTS codigo_tipo_partida numeric NULL,
  ADD COLUMN IF NOT EXISTS codigo_tipo_freio numeric NULL,
  ADD COLUMN IF NOT EXISTS codigo_sms numeric NULL,
  ADD COLUMN IF NOT EXISTS tipo_consistencia numeric NULL;
