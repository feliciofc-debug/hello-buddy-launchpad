
-- TAREFA 1: Atualizar tabela leads_imoveis_enriquecidos para validação multi-fonte

-- Validação Multi-Fonte
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS fontes_encontradas text[] DEFAULT '{}';
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS confianca_dados integer DEFAULT 0;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS status_validacao text DEFAULT 'pendente';

-- Dados OLX
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS olx_perfil_url text;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS olx_anuncios_ativos integer DEFAULT 0;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS olx_anuncios_historico jsonb DEFAULT '[]';
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS olx_telefone_confirmado boolean DEFAULT false;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS olx_ultima_atividade timestamp with time zone;

-- Dados Quinto Andar
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS quintoandar_perfil_url text;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS quintoandar_tipo text;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS quintoandar_imoveis jsonb DEFAULT '[]';
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS quintoandar_verificado boolean DEFAULT false;

-- Dados ZAP Imóveis
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS zap_perfil_url text;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS zap_anuncios integer DEFAULT 0;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS zap_telefone text;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS zap_email text;

-- Dados VivaReal
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS vivareal_perfil_url text;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS vivareal_anuncios integer DEFAULT 0;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS vivareal_corretor boolean DEFAULT false;

-- Validação de Foto (IA) - preparando para depois
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS foto_google_url text;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS similaridade_fotos integer;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS fotos_validadas boolean DEFAULT false;

-- Matching Score Detalhado
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS score_nome integer DEFAULT 0;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS score_telefone integer DEFAULT 0;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS score_localizacao integer DEFAULT 0;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS score_atividade integer DEFAULT 0;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS score_redes_sociais integer DEFAULT 0;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS score_foto integer DEFAULT 0;

-- Dados Oficiais
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS cpf_validado boolean DEFAULT false;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS cnpj_empresa text;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS empresa_validada boolean DEFAULT false;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS renda_oficial numeric;

-- Propriedades e Buscas Identificadas
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS imoveis_possui jsonb DEFAULT '[]';
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS buscas_identificadas jsonb DEFAULT '[]';

-- Logs de Validação
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS log_validacao jsonb DEFAULT '[]';
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS data_validacao timestamp with time zone;
ALTER TABLE leads_imoveis_enriquecidos ADD COLUMN IF NOT EXISTS validado_por text;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_confianca ON leads_imoveis_enriquecidos(confianca_dados DESC);
CREATE INDEX IF NOT EXISTS idx_leads_validacao ON leads_imoveis_enriquecidos(status_validacao);
CREATE INDEX IF NOT EXISTS idx_leads_fontes ON leads_imoveis_enriquecidos USING GIN(fontes_encontradas);
