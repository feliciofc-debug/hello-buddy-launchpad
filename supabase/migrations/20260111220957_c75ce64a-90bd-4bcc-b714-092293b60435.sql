-- Adicionar suporte a TikTok na programação de envio
ALTER TABLE public.programacao_envio_afiliado 
ADD COLUMN IF NOT EXISTS enviar_tiktok boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tiktok_post_mode text DEFAULT 'draft';

-- Comentário explicativo
COMMENT ON COLUMN public.programacao_envio_afiliado.enviar_tiktok IS 'Se true, envia também para o TikTok conectado';
COMMENT ON COLUMN public.programacao_envio_afiliado.tiktok_post_mode IS 'Modo de postagem TikTok: draft ou direct';