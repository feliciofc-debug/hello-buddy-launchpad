
ALTER TABLE public.pj_clientes_config
ADD COLUMN IF NOT EXISTS limite_imagens_ia_mes INTEGER NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS imagens_ia_mes_atual INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS mes_referencia_ia TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM');
