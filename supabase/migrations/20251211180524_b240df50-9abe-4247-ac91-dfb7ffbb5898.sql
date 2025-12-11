-- Tornar user_id nullable para cadastros que vêm do site público
ALTER TABLE cadastros ALTER COLUMN user_id DROP NOT NULL;

-- Atualizar a função de sincronização
CREATE OR REPLACE FUNCTION sync_optin_to_cadastro()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cadastros (
    nome,
    whatsapp,
    email,
    opt_in,
    opt_in_id,
    origem
  ) VALUES (
    NEW.nome,
    NEW.whatsapp,
    NEW.email,
    true,
    NEW.id,
    COALESCE(NEW.origem, 'site_footer')
  )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Adicionar política para visualizar cadastros públicos (sem user_id)
CREATE POLICY "Users can view public cadastros"
ON cadastros FOR SELECT
USING (user_id IS NULL);

-- Atualizar política de update para permitir "reivindicar" cadastros
CREATE POLICY "Users can claim public cadastros"
ON cadastros FOR UPDATE
USING (user_id IS NULL)
WITH CHECK (auth.uid() = user_id);