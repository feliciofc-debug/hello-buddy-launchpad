-- Adicionar colunas necessárias para o sistema de cobrança recorrente
ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS dia_vencimento smallint,
  ADD COLUMN IF NOT EXISTS amount numeric(10,2) NOT NULL DEFAULT 597.00,
  ADD COLUMN IF NOT EXISTS cobranca_manual boolean NOT NULL DEFAULT false;

-- Validação via trigger (em vez de CHECK) para permitir flexibilidade futura
CREATE OR REPLACE FUNCTION public.validar_dia_vencimento_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.dia_vencimento IS NOT NULL AND (NEW.dia_vencimento < 1 OR NEW.dia_vencimento > 31) THEN
    RAISE EXCEPTION 'dia_vencimento deve estar entre 1 e 31, recebido: %', NEW.dia_vencimento;
  END IF;
  IF NEW.amount IS NOT NULL AND NEW.amount <= 0 THEN
    RAISE EXCEPTION 'amount deve ser maior que zero, recebido: %', NEW.amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_billing_subscription ON public.billing_subscriptions;
CREATE TRIGGER trg_validar_billing_subscription
  BEFORE INSERT OR UPDATE ON public.billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_dia_vencimento_billing();

-- Índice para o cron diário de recálculo (busca rápida por dia + status)
CREATE INDEX IF NOT EXISTS idx_billing_sub_venc_status
  ON public.billing_subscriptions(dia_vencimento, status)
  WHERE cobranca_manual = false;