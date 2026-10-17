-- LM.1: claim atômico no tick (status processing)

ALTER TABLE public.vitrine_lead_morno_agenda
  DROP CONSTRAINT IF EXISTS vitrine_lead_morno_agenda_status_check;

ALTER TABLE public.vitrine_lead_morno_agenda
  ADD CONSTRAINT vitrine_lead_morno_agenda_status_check CHECK (
    status IN ('pending', 'processing', 'cancelled', 'done')
  );

ALTER TABLE public.vitrine_retomada_agenda
  DROP CONSTRAINT IF EXISTS vitrine_retomada_agenda_status_check;

ALTER TABLE public.vitrine_retomada_agenda
  ADD CONSTRAINT vitrine_retomada_agenda_status_check CHECK (
    status IN ('pending', 'processing', 'cancelled', 'done')
  );
