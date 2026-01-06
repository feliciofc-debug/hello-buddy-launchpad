-- Adicionar campo amazon_affiliate_tag na tabela clientes_afiliados
ALTER TABLE public.clientes_afiliados 
ADD COLUMN IF NOT EXISTS amazon_affiliate_tag TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.clientes_afiliados.amazon_affiliate_tag IS 'Tag de afiliado Amazon do usuário (ex: amzofertas03-20)';