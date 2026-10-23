-- WEBMOTORS-1.2: persistir respostas Sim/Não do anúncio (IncluirCarro/AlterarCarro)

ALTER TABLE public.veiculos_portais
  ADD COLUMN IF NOT EXISTS anuncio_sn jsonb NULL;

COMMENT ON COLUMN public.veiculos_portais.anuncio_sn IS
  'Respostas Sim/Não enviadas à Webmotors (S/N por campo). Usado em sync sem resetar valores marcados na publicação.';
