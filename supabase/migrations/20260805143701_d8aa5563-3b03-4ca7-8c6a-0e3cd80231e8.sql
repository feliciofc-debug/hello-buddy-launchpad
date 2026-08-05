UPDATE public.whatsapp_templates
SET body_text = 'Oi {{1}}! Aqui é a AMZ Ofertas. Sua oferta selecionada de hoje: {{2}} por apenas {{3}}. Responda DETALHES para receber o link ou SAIR para não receber mais mensagens.',
    updated_at = now()
WHERE nome_meta = 'campanha_oferta_v1' AND status_meta = 'rascunho';