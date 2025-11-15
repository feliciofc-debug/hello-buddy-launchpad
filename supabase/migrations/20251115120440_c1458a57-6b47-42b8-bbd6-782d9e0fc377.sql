-- Habilitar RLS nas novas tabelas
ALTER TABLE fontes_dados ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas_multiplas_fontes ENABLE ROW LEVEL SECURITY;

-- Políticas para fontes_dados (leitura pública)
CREATE POLICY "Anyone can view fontes_dados"
  ON fontes_dados
  FOR SELECT
  USING (true);

CREATE POLICY "Only system can manage fontes_dados"
  ON fontes_dados
  FOR ALL
  USING (false);

-- Políticas para campanhas_multiplas_fontes
CREATE POLICY "Users can view own campaign sources"
  ON campanhas_multiplas_fontes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campanhas_prospeccao
      WHERE campanhas_prospeccao.id = campanhas_multiplas_fontes.campanha_id
      AND campanhas_prospeccao.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own campaign sources"
  ON campanhas_multiplas_fontes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campanhas_prospeccao
      WHERE campanhas_prospeccao.id = campanhas_multiplas_fontes.campanha_id
      AND campanhas_prospeccao.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own campaign sources"
  ON campanhas_multiplas_fontes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campanhas_prospeccao
      WHERE campanhas_prospeccao.id = campanhas_multiplas_fontes.campanha_id
      AND campanhas_prospeccao.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own campaign sources"
  ON campanhas_multiplas_fontes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campanhas_prospeccao
      WHERE campanhas_prospeccao.id = campanhas_multiplas_fontes.campanha_id
      AND campanhas_prospeccao.user_id = auth.uid()
    )
  );