-- Vínculo forte geração → asset → aprovação → publicação.
ALTER TABLE public.midias_whatsapp
  ADD COLUMN IF NOT EXISTS generation_job_id uuid,
  ADD COLUMN IF NOT EXISTS generation_job_type text,
  ADD COLUMN IF NOT EXISTS arquivo_nome text;

ALTER TABLE public.social_posts_queue
  ADD COLUMN IF NOT EXISTS asset_id uuid,
  ADD COLUMN IF NOT EXISTS asset_tipo text,
  ADD COLUMN IF NOT EXISTS approved_media_type text,
  ADD COLUMN IF NOT EXISTS origem_fluxo text NOT NULL DEFAULT 'plataforma';

CREATE INDEX IF NOT EXISTS idx_midias_whatsapp_generation_job
  ON public.midias_whatsapp (generation_job_type, generation_job_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_queue_asset
  ON public.social_posts_queue (asset_id);

-- Nenhuma linha originada no Jarvis pode ir a 'publicado' sem asset + aprovação
-- vinculadas, e o tipo aprovado precisa bater com o tipo do asset.
CREATE OR REPLACE FUNCTION public.social_post_exige_vinculo_asset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'publicado' AND COALESCE(NEW.origem_fluxo, 'plataforma') = 'jarvis' THEN
    IF NEW.asset_id IS NULL OR NEW.approval_token IS NULL OR NEW.approved_at IS NULL THEN
      RAISE EXCEPTION 'publicacao_sem_vinculo_de_asset_ou_aprovacao';
    END IF;
    IF NEW.approved_media_type IS NULL OR NEW.asset_tipo IS NULL
       OR NEW.approved_media_type <> NEW.asset_tipo THEN
      RAISE EXCEPTION 'tipo_aprovado_diferente_do_asset';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_post_exige_vinculo_asset ON public.social_posts_queue;
CREATE TRIGGER trg_social_post_exige_vinculo_asset
  BEFORE INSERT OR UPDATE ON public.social_posts_queue
  FOR EACH ROW EXECUTE FUNCTION public.social_post_exige_vinculo_asset();