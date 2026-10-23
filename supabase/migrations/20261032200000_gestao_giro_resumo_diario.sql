-- G90-2: resumo diário do Giro 30-60-90 via WhatsApp

ALTER TABLE public.gestao_giro_config
  ADD COLUMN IF NOT EXISTS resumo_diario_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resumo_diario_hora time NOT NULL DEFAULT '18:00:00',
  ADD COLUMN IF NOT EXISTS resumo_ultimo_envio date NULL,
  ADD COLUMN IF NOT EXISTS fipe_auto_ultima_competencia text NULL;

COMMENT ON COLUMN public.gestao_giro_config.resumo_diario_ativo IS
  'Envia resumo diário do estoque (Giro 30-60-90) ao dono/gestores via WhatsApp.';
COMMENT ON COLUMN public.gestao_giro_config.resumo_diario_hora IS
  'Horário local (America/Sao_Paulo) para disparo do resumo.';
COMMENT ON COLUMN public.gestao_giro_config.resumo_ultimo_envio IS
  'Último dia (calendário SP) em que o resumo foi enviado com sucesso ao dono.';
COMMENT ON COLUMN public.gestao_giro_config.fipe_auto_ultima_competencia IS
  'Competência YYYY-MM da última rodada automática de FIPE (mensal).';
