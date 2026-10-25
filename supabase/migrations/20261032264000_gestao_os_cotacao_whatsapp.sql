-- COTACAO-WPP-1: WhatsApp parceiro — envio, resposta e trilha na OS

ALTER TABLE public.gestao_os_cotacao
  DROP CONSTRAINT IF EXISTS gestao_os_cotacao_status_check;
ALTER TABLE public.gestao_os_cotacao
  ADD CONSTRAINT gestao_os_cotacao_status_check CHECK (
    status IN ('solicitada', 'recebida', 'escolhida', 'descartada', 'recusada')
  );

ALTER TABLE public.gestao_os_cotacao
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'painel'
    CHECK (canal IN ('painel', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS envio_whatsapp_status text NULL
    CHECK (envio_whatsapp_status IS NULL OR envio_whatsapp_status IN (
      'enviado', 'pendente_modelo', 'falhou', 'nao_aplicavel'
    )),
  ADD COLUMN IF NOT EXISTS envio_whatsapp_erro text NULL,
  ADD COLUMN IF NOT EXISTS envio_pendente_motivo text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_conversation_id uuid NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_pedido_message_id text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_resposta_message_id text NULL,
  ADD COLUMN IF NOT EXISTS transcricao_audio text NULL,
  ADD COLUMN IF NOT EXISTS recusada_em timestamptz NULL;

ALTER TABLE public.gestao_os_evento
  DROP CONSTRAINT IF EXISTS gestao_os_evento_origem_check;
ALTER TABLE public.gestao_os_evento
  ADD CONSTRAINT gestao_os_evento_origem_check CHECK (
    origem IN ('painel', 'automacao', 'whatsapp_parceiro')
  );

CREATE TABLE IF NOT EXISTS public.gestao_os_cotacao_wa_sessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parceiro_id uuid NOT NULL,
  cotacao_id uuid NULL,
  fase text NOT NULL,
  draft_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  dica_enviada_em timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_os_cotacao_wa_sessao_parceiro_fk
    FOREIGN KEY (user_id, parceiro_id)
    REFERENCES public.gestao_parceiro(user_id, id) ON DELETE CASCADE,
  CONSTRAINT gestao_os_cotacao_wa_sessao_cotacao_fk
    FOREIGN KEY (user_id, cotacao_id)
    REFERENCES public.gestao_os_cotacao(user_id, id) ON DELETE CASCADE,
  UNIQUE (user_id, parceiro_id)
);

ALTER TABLE public.gestao_os_cotacao_wa_sessao ENABLE ROW LEVEL SECURITY;
CREATE POLICY gestao_os_cotacao_wa_sessao_service ON public.gestao_os_cotacao_wa_sessao
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON public.gestao_os_cotacao_wa_sessao TO service_role;

CREATE OR REPLACE FUNCTION public.gestao_os_cotacao_aplicar_resposta_parceiro(
  p_cotacao_id uuid,
  p_status text,
  p_valor numeric DEFAULT NULL,
  p_prazo_dias integer DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_transcricao text DEFAULT NULL,
  p_whatsapp_message_id text DEFAULT NULL,
  p_whatsapp_conversation_id uuid DEFAULT NULL
)
RETURNS public.gestao_os_cotacao
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cot public.gestao_os_cotacao%ROWTYPE;
  ordem public.gestao_os%ROWTYPE;
  parceiro public.gestao_parceiro%ROWTYPE;
  msg text;
BEGIN
  SELECT * INTO cot FROM public.gestao_os_cotacao WHERE id = p_cotacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF p_status NOT IN ('recebida', 'recusada') THEN
    RAISE EXCEPTION 'Status inválido para resposta de parceiro';
  END IF;

  SELECT * INTO ordem FROM public.gestao_os WHERE id = cot.os_id;
  SELECT * INTO parceiro FROM public.gestao_parceiro WHERE id = cot.parceiro_id;

  IF p_status = 'recusada' THEN
    UPDATE public.gestao_os_cotacao SET
      status = 'recusada',
      recusada_em = now(),
      canal = 'whatsapp',
      observacao = coalesce(nullif(trim(p_observacao), ''), observacao),
      transcricao_audio = coalesce(p_transcricao, transcricao_audio),
      whatsapp_resposta_message_id = coalesce(p_whatsapp_message_id, whatsapp_resposta_message_id),
      whatsapp_conversation_id = coalesce(p_whatsapp_conversation_id, whatsapp_conversation_id),
      updated_at = now()
    WHERE id = cot.id RETURNING * INTO cot;
    msg := coalesce(parceiro.nome, 'Parceiro') || ' recusou a cotação via WhatsApp.';
  ELSE
    IF p_valor IS NULL OR p_valor < 0 THEN
      RAISE EXCEPTION 'Informe o valor da cotação';
    END IF;
    UPDATE public.gestao_os_cotacao SET
      status = 'recebida',
      valor = p_valor,
      prazo_dias = p_prazo_dias,
      observacao = nullif(trim(p_observacao), ''),
      recebida_em = now(),
      canal = 'whatsapp',
      transcricao_audio = coalesce(p_transcricao, transcricao_audio),
      whatsapp_resposta_message_id = coalesce(p_whatsapp_message_id, whatsapp_resposta_message_id),
      whatsapp_conversation_id = coalesce(p_whatsapp_conversation_id, whatsapp_conversation_id),
      updated_at = now()
    WHERE id = cot.id RETURNING * INTO cot;
    msg := coalesce(parceiro.nome, 'Parceiro') || ' respondeu via WhatsApp: R$ ' ||
      to_char(p_valor, 'FM999G999G990D00') ||
      coalesce(' · ' || p_prazo_dias || ' dia(s)', '');
  END IF;

  INSERT INTO public.gestao_os_evento (
    user_id, os_id, tipo, origem, mensagem, metadados_json
  ) VALUES (
    cot.user_id, cot.os_id, 'cotacao', 'whatsapp_parceiro', msg,
    jsonb_build_object(
      'cotacao_id', cot.id,
      'parceiro_id', cot.parceiro_id,
      'status', p_status,
      'valor', p_valor,
      'prazo_dias', p_prazo_dias
    )
  );
  RETURN cot;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_cotacao_aplicar_resposta_parceiro(
  uuid, text, numeric, integer, text, text, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_cotacao_aplicar_resposta_parceiro(
  uuid, text, numeric, integer, text, text, text, uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.gestao_os_cotacao_marcar_envio_whatsapp(
  p_cotacao_id uuid,
  p_status text,
  p_erro text DEFAULT NULL,
  p_pendente_motivo text DEFAULT NULL,
  p_message_id text DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL
)
RETURNS public.gestao_os_cotacao
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cot public.gestao_os_cotacao%ROWTYPE;
BEGIN
  UPDATE public.gestao_os_cotacao SET
    envio_whatsapp_status = p_status,
    envio_whatsapp_erro = nullif(trim(p_erro), ''),
    envio_pendente_motivo = nullif(trim(p_pendente_motivo), ''),
    whatsapp_pedido_message_id = coalesce(p_message_id, whatsapp_pedido_message_id),
    whatsapp_conversation_id = coalesce(p_conversation_id, whatsapp_conversation_id),
    updated_at = now()
  WHERE id = p_cotacao_id
  RETURNING * INTO cot;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  RETURN cot;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_cotacao_marcar_envio_whatsapp(
  uuid, text, text, text, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_cotacao_marcar_envio_whatsapp(
  uuid, text, text, text, text, uuid
) TO service_role;
