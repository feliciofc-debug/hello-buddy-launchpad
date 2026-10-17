-- LM.5 / ML-5: RLS em ml_crm_tick_meta (sem policies — só service_role)

ALTER TABLE public.ml_crm_tick_meta ENABLE ROW LEVEL SECURITY;
