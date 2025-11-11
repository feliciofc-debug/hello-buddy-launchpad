-- Criar tabela empresas se não existir
CREATE TABLE IF NOT EXISTS empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text UNIQUE NOT NULL,
  razao_social text NOT NULL,
  nome_fantasia text,
  telefone text,
  email text,
  porte text,
  natureza_juridica text,
  capital_social numeric,
  data_abertura date,
  situacao_cadastral text,
  endereco jsonb DEFAULT '{}'::jsonb,
  atividade_principal jsonb,
  atividades_secundarias jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela socios se não existir
CREATE TABLE IF NOT EXISTS socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  cpf text,
  qualificacao text,
  data_entrada date,
  percentual_capital numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Adicionar foreign key em prospects_qualificados para socios
ALTER TABLE prospects_qualificados
DROP CONSTRAINT IF EXISTS prospects_qualificados_socio_id_fkey;

ALTER TABLE prospects_qualificados
ADD CONSTRAINT prospects_qualificados_socio_id_fkey
FOREIGN KEY (socio_id) REFERENCES socios(id) ON DELETE CASCADE;

-- Habilitar RLS nas novas tabelas
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE socios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para empresas (públicas para leitura)
CREATE POLICY "Anyone can view empresas"
  ON empresas FOR SELECT
  USING (true);

CREATE POLICY "System can manage empresas"
  ON empresas FOR ALL
  USING (true);

-- Políticas RLS para socios (públicos para leitura)
CREATE POLICY "Anyone can view socios"
  ON socios FOR SELECT
  USING (true);

CREATE POLICY "System can manage socios"
  ON socios FOR ALL
  USING (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_socios_empresa_id ON socios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_prospects_socio_id ON prospects_qualificados(socio_id);
CREATE INDEX IF NOT EXISTS idx_empresas_cnpj ON empresas(cnpj);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_empresas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON empresas
  FOR EACH ROW
  EXECUTE FUNCTION update_empresas_updated_at();

CREATE OR REPLACE FUNCTION update_socios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_socios_updated_at
  BEFORE UPDATE ON socios
  FOR EACH ROW
  EXECUTE FUNCTION update_socios_updated_at();