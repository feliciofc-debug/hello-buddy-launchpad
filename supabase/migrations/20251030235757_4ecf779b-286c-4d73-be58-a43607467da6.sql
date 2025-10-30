-- Adicionar novos campos à tabela profiles para suportar afiliados e empresas
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tipo text CHECK (tipo IN ('afiliado', 'empresa')),
ADD COLUMN IF NOT EXISTS cpf_cnpj text,
ADD COLUMN IF NOT EXISTS razao_social text,
ADD COLUMN IF NOT EXISTS nome_fantasia text,
ADD COLUMN IF NOT EXISTS cnae text,
ADD COLUMN IF NOT EXISTS cnae_descricao text,
ADD COLUMN IF NOT EXISTS endereco jsonb,
ADD COLUMN IF NOT EXISTS plano text DEFAULT 'free' CHECK (plano IN ('free', 'empresas', 'premium')),
ADD COLUMN IF NOT EXISTS valor_plano numeric DEFAULT 0;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_profiles_tipo ON public.profiles(tipo);
CREATE INDEX IF NOT EXISTS idx_profiles_plano ON public.profiles(plano);
CREATE INDEX IF NOT EXISTS idx_profiles_cpf_cnpj ON public.profiles(cpf_cnpj);

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.tipo IS 'Tipo de usuário: afiliado ou empresa';
COMMENT ON COLUMN public.profiles.cpf_cnpj IS 'CPF (para afiliados) ou CNPJ (para empresas)';
COMMENT ON COLUMN public.profiles.razao_social IS 'Razão social da empresa';
COMMENT ON COLUMN public.profiles.nome_fantasia IS 'Nome fantasia da empresa';
COMMENT ON COLUMN public.profiles.cnae IS 'Código CNAE da empresa';
COMMENT ON COLUMN public.profiles.cnae_descricao IS 'Descrição do CNAE';
COMMENT ON COLUMN public.profiles.endereco IS 'Endereço completo (JSON)';
COMMENT ON COLUMN public.profiles.plano IS 'Plano contratado: free, empresas ou premium';
COMMENT ON COLUMN public.profiles.valor_plano IS 'Valor mensal do plano em reais';