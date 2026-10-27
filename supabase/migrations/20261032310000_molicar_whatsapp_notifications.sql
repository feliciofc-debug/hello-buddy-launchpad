-- VEIC-WPP-1 — agrupa os três serviços de procedência e limita notificações
-- automáticas às solicitações iniciadas pelo WhatsApp.

ALTER TABLE public.molicar_procedencia
  ADD COLUMN IF NOT EXISTS solicitacao_id uuid NULL,
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'painel',
  ADD COLUMN IF NOT EXISTS notificar_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_notificado_em timestamptz NULL;

ALTER TABLE public.molicar_procedencia
  DROP CONSTRAINT IF EXISTS molicar_procedencia_canal_check;
ALTER TABLE public.molicar_procedencia
  ADD CONSTRAINT molicar_procedencia_canal_check
  CHECK (canal IN ('painel', 'whatsapp', 'automatico'));

CREATE INDEX IF NOT EXISTS molicar_procedencia_solicitacao_idx
  ON public.molicar_procedencia(user_id, solicitacao_id)
  WHERE solicitacao_id IS NOT NULL;

COMMENT ON COLUMN public.molicar_procedencia.solicitacao_id IS
  'Agrupa debts, gravame e renajud disparados pela mesma ação.';
COMMENT ON COLUMN public.molicar_procedencia.notificar_whatsapp IS
  'True somente para solicitação iniciada pelo fluxo autorizado do WhatsApp.';
