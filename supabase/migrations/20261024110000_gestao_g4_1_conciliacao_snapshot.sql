-- G4.1: snapshot para desfazer conciliação (DDL only)

ALTER TABLE public.gestao_extrato_transacao
  ADD COLUMN IF NOT EXISTS match_liquidacao_snapshot jsonb NULL;
