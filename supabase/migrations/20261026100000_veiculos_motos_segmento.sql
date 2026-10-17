-- Motos: segmento + campos opcionais (DDL only)

ALTER TABLE public.veiculos_estoque
  ADD COLUMN IF NOT EXISTS segmento text NOT NULL DEFAULT 'carro'
    CHECK (segmento IN ('carro', 'moto'));

ALTER TABLE public.veiculos_estoque
  ADD COLUMN IF NOT EXISTS cilindrada_cc integer NULL
    CHECK (cilindrada_cc IS NULL OR (cilindrada_cc > 0 AND cilindrada_cc <= 2500));

ALTER TABLE public.veiculos_estoque
  ADD COLUMN IF NOT EXISTS estilo_moto text NULL
    CHECK (estilo_moto IS NULL OR estilo_moto IN (
      'naked', 'esportiva', 'custom', 'trail', 'scooter', 'touring', 'street', 'off_road'
    ));

ALTER TABLE public.veiculos_estoque
  ADD COLUMN IF NOT EXISTS partida text NULL
    CHECK (partida IS NULL OR partida IN ('eletrica', 'pedal'));

ALTER TABLE public.veiculos_estoque
  ADD COLUMN IF NOT EXISTS refrigeracao text NULL
    CHECK (refrigeracao IS NULL OR refrigeracao IN ('ar', 'liquida'));

CREATE INDEX IF NOT EXISTS idx_veiculos_estoque_user_segmento_status
  ON public.veiculos_estoque (user_id, segmento, status);
