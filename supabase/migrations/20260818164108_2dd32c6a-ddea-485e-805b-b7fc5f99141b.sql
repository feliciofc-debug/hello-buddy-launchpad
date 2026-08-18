ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS voz_copy TEXT NOT NULL DEFAULT 'empresa',
  ADD COLUMN IF NOT EXISTS nome_assinatura TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'empresa_config_voz_copy_check'
  ) THEN
    ALTER TABLE public.empresa_config
      ADD CONSTRAINT empresa_config_voz_copy_check CHECK (voz_copy IN ('empresa','pessoa'));
  END IF;
END $$;

INSERT INTO public.empresa_config (user_id, voz_copy, nome_assinatura)
VALUES ('d6159ef4-f0bd-4935-a335-c5e8964e4f17', 'pessoa', 'Paulo Canarim')
ON CONFLICT (user_id) DO UPDATE
  SET voz_copy = 'pessoa', nome_assinatura = 'Paulo Canarim';