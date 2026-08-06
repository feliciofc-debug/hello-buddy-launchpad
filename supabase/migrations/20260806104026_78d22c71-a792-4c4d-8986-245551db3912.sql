UPDATE public.whatsapp_templates
SET botoes = '[{"type":"QUICK_REPLY","text":"Quero esta oferta!"},{"type":"QUICK_REPLY","text":"Não quero mais"}]'::jsonb
WHERE nome_meta = 'campanha_oferta_img_v1' AND status_meta = 'rascunho';