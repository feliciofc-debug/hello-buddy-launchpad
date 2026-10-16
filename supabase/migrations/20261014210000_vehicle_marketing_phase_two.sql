-- Fase 2: Modo FB, textos personalizados e cancelamento de story de veículo.

BEGIN;

ALTER TABLE public.veiculos_estoque
  ADD COLUMN IF NOT EXISTS modo_postagem_fb TEXT DEFAULT 'promocional',
  ADD COLUMN IF NOT EXISTS engajamento_estilos TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS usa_textos_personalizados BOOLEAN DEFAULT false;

ALTER TABLE public.autopilot_textos_personalizados
  ALTER COLUMN produto_id DROP NOT NULL;

ALTER TABLE public.autopilot_textos_personalizados
  ADD COLUMN IF NOT EXISTS veiculo_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'autopilot_textos_personalizados_item_vinculo_check'
  ) THEN
    ALTER TABLE public.autopilot_textos_personalizados
      ADD CONSTRAINT autopilot_textos_personalizados_item_vinculo_check
      CHECK (
        (produto_id IS NOT NULL AND veiculo_id IS NULL)
        OR (veiculo_id IS NOT NULL AND produto_id IS NULL)
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.autopilot_textos_personalizados
  VALIDATE CONSTRAINT autopilot_textos_personalizados_item_vinculo_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'autopilot_textos_personalizados_veiculo_id_fkey'
  ) THEN
    ALTER TABLE public.autopilot_textos_personalizados
      ADD CONSTRAINT autopilot_textos_personalizados_veiculo_id_fkey
      FOREIGN KEY (veiculo_id)
      REFERENCES public.veiculos_estoque(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_autopilot_textos_veiculo
  ON public.autopilot_textos_personalizados(veiculo_id, ativo)
  WHERE veiculo_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cancel_vehicle_marketing_on_unavailable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_id UUID;
  cancel_reason TEXT := CASE
    WHEN TG_OP = 'DELETE' THEN 'veiculo_removido'
    ELSE 'veiculo_vendido'
  END;
BEGIN
  target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  IF TG_OP = 'DELETE'
    OR (
      TG_OP = 'UPDATE'
      AND NEW.status = 'vendido'
      AND OLD.status IS DISTINCT FROM NEW.status
    )
  THEN
    UPDATE public.social_posts_queue
    SET status = 'cancelado',
        error_message = cancel_reason,
        updated_at = now()
    WHERE item_tipo = 'veiculo'
      AND veiculo_id = target_id
      AND status IN ('pendente', 'processando');

    UPDATE public.veiculos_campanhas_recorrentes
    SET ativa = false,
        status = 'cancelada',
        updated_at = now()
    WHERE veiculo_id = target_id
      AND ativa IS TRUE;

    UPDATE public.videos_agendados
    SET status = 'cancelado',
        erro = cancel_reason,
        updated_at = now()
    WHERE tipo = 'story_imagem'
      AND status IN ('pendente', 'processando')
      AND metadata->>'veiculo_id' = target_id::text;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
