
-- Copiar os 1522 cadastros de feliciofc para afiliados@amzofertas
-- Evitando duplicatas pelo whatsapp
INSERT INTO cadastros (nome, whatsapp, email, empresa, origem, tags, opt_in, notas, user_id, created_at)
SELECT 
  c.nome, 
  c.whatsapp, 
  c.email, 
  c.empresa, 
  COALESCE(c.origem, 'migrado-feliciofc'), 
  c.tags, 
  c.opt_in, 
  c.notas,
  '9bffb483-8c27-4ce9-a325-b7d0ec46c480'::uuid,
  c.created_at
FROM cadastros c
WHERE c.user_id = 'a4c11b1f-5a72-420e-a649-b703a2e6bcd0'
  AND NOT EXISTS (
    SELECT 1 FROM cadastros existing
    WHERE existing.user_id = '9bffb483-8c27-4ce9-a325-b7d0ec46c480'
      AND existing.whatsapp = c.whatsapp
  );
