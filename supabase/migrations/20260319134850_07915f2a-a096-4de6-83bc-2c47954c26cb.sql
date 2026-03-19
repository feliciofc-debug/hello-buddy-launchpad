
-- Only add tables not yet in realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fila_atendimento_pj;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sophia_campanhas;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
