-- Fase 0/1 da vertical de veículos: vínculos aditivos para publicação e
-- campanhas. As estruturas existentes de produtos permanecem inalteradas.

ALTER TABLE public.social_posts_queue
  ADD COLUMN IF NOT EXISTS item_tipo TEXT DEFAULT 'produto',
  ADD COLUMN IF NOT EXISTS veiculo_id UUID;

ALTER TABLE public.social_posts_queue
  ADD CONSTRAINT social_posts_queue_item_vinculo_check CHECK (
    (item_tipo IS NULL AND veiculo_id IS NULL)
    OR (item_tipo = 'produto' AND veiculo_id IS NULL)
    OR (
      item_tipo = 'veiculo'
      AND veiculo_id IS NOT NULL
      AND produto_id IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_social_posts_queue_vehicle
  ON public.social_posts_queue(user_id, veiculo_id, status)
  WHERE item_tipo = 'veiculo';

CREATE OR REPLACE FUNCTION public.validate_vehicle_social_queue_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.item_tipo = 'veiculo' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.veiculos_estoque vehicle
      WHERE vehicle.id = NEW.veiculo_id
        AND vehicle.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'veiculo_id não pertence ao tenant da publicação';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_vehicle_social_queue_owner_trigger
  BEFORE INSERT OR UPDATE OF item_tipo, veiculo_id, user_id
  ON public.social_posts_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_vehicle_social_queue_owner();

ALTER TABLE public.veiculos_estoque
  ADD COLUMN IF NOT EXISTS incluir_cta_whatsapp BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.veiculos_campanhas_recorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id UUID NOT NULL REFERENCES public.veiculos_estoque(id) ON DELETE CASCADE,
  item_tipo TEXT DEFAULT 'veiculo' CHECK (item_tipo = 'veiculo'),
  nome TEXT NOT NULL,
  listas_ids UUID[] NOT NULL,
  frequencia TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  horarios TIME[] NOT NULL DEFAULT ARRAY['10:00']::TIME[],
  dias_semana INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  mensagem_template TEXT NOT NULL,
  ativa BOOLEAN DEFAULT true,
  proxima_execucao TIMESTAMPTZ,
  ultima_execucao TIMESTAMPTZ,
  total_enviados INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ativa',
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
  pj_grupos_ids UUID[],
  canal TEXT DEFAULT 'meta_oficial',
  intervalo_minutos INTEGER,
  max_envios_dia INTEGER DEFAULT 200,
  autopilot BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.veiculos_campanhas_recorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_campaigns_select_own"
  ON public.veiculos_campanhas_recorrentes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "vehicle_campaigns_insert_own"
  ON public.veiculos_campanhas_recorrentes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.veiculos_estoque vehicle
      WHERE vehicle.id = veiculo_id
        AND vehicle.user_id = auth.uid()
    )
  );

CREATE POLICY "vehicle_campaigns_update_own"
  ON public.veiculos_campanhas_recorrentes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.veiculos_estoque vehicle
      WHERE vehicle.id = veiculo_id
        AND vehicle.user_id = auth.uid()
    )
  );

CREATE POLICY "vehicle_campaigns_delete_own"
  ON public.veiculos_campanhas_recorrentes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_campaigns_due
  ON public.veiculos_campanhas_recorrentes(ativa, proxima_execucao);
CREATE INDEX IF NOT EXISTS idx_vehicle_campaigns_vehicle
  ON public.veiculos_campanhas_recorrentes(user_id, veiculo_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.veiculos_campanhas_recorrentes TO authenticated;
GRANT ALL ON public.veiculos_campanhas_recorrentes TO service_role;

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
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cancel_vehicle_marketing_on_unavailable_trigger
  BEFORE DELETE OR UPDATE OF status
  ON public.veiculos_estoque
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_vehicle_marketing_on_unavailable();
