INSERT INTO public.trilhas_sonoras (user_id, nome, descricao, mood, duracao_seg, storage_path, licenca, licenca_url, ativo, padrao_global)
VALUES
 (NULL, 'Piano Suave (AMZ)', 'Piano leve e institucional. Produzida pela AMZ para uso nos vídeos da plataforma.', 'corporativo', 25.5, 'global/piano-suave-amz.mp3', 'Produção própria AMZ — uso comercial liberado para clientes da plataforma', NULL, true, true),
 (NULL, 'Piano Suave — Lento', 'Versão mais lenta, para vídeos mais longos ou institucionais.', 'corporativo', 29.0, 'global/piano-suave-lento.mp3', 'Produção própria AMZ — uso comercial liberado para clientes da plataforma', NULL, true, false),
 (NULL, 'Piano Suave — Curto', 'Versão de 12 segundos, para Stories e vídeos curtos.', 'corporativo', 12.0, 'global/piano-suave-curto.mp3', 'Produção própria AMZ — uso comercial liberado para clientes da plataforma', NULL, true, false)
ON CONFLICT DO NOTHING;