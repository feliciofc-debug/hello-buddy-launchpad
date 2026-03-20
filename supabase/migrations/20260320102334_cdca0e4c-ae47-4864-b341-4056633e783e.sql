DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fila_atendimento_pj'
      AND policyname = 'Authenticated users can insert own queue items'
  ) THEN
    CREATE POLICY "Authenticated users can insert own queue items"
    ON public.fila_atendimento_pj
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;