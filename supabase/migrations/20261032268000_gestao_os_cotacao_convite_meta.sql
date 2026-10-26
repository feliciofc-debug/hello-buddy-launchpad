-- COTACAO-WPP-1.2: convite Meta antes do PDF fora da janela de 24h

ALTER TABLE public.gestao_os_cotacao
  DROP CONSTRAINT IF EXISTS gestao_os_cotacao_envio_whatsapp_status_check;
ALTER TABLE public.gestao_os_cotacao
  DROP CONSTRAINT IF EXISTS gestao_os_cotacao_envio_whatsapp_status_check1;

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT c.conname INTO v_constraint
  FROM pg_constraint c
  WHERE c.conrelid = 'public.gestao_os_cotacao'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%envio_whatsapp_status%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.gestao_os_cotacao DROP CONSTRAINT %I', v_constraint);
  END IF;
END;
$$;

ALTER TABLE public.gestao_os_cotacao
  ADD CONSTRAINT gestao_os_cotacao_envio_whatsapp_status_check CHECK (
    envio_whatsapp_status IS NULL OR envio_whatsapp_status IN (
      'enviado', 'convite_enviado', 'pendente_modelo', 'falhou', 'nao_aplicavel'
    )
  );
