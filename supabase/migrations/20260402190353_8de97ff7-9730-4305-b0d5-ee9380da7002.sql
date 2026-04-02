
-- Tabela de configuração de trial
CREATE TABLE public.trial_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  -- Limites de IA Marketing
  limite_imagens_ia INTEGER NOT NULL DEFAULT 3,
  imagens_ia_usadas INTEGER NOT NULL DEFAULT 0,
  ia_marketing_bloqueada BOOLEAN NOT NULL DEFAULT false,
  -- Limites de posts
  limite_posts_dia INTEGER NOT NULL DEFAULT 2,
  posts_hoje INTEGER NOT NULL DEFAULT 0,
  data_ultimo_post DATE,
  -- Período do trial
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Status
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo, expirado, convertido, bloqueado
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE public.trial_configs ENABLE ROW LEVEL SECURITY;

-- Usuário pode ver sua própria config
CREATE POLICY "Users can view own trial config"
ON public.trial_configs
FOR SELECT
USING (auth.uid() = user_id);

-- Service role pode tudo (para edge functions)
CREATE POLICY "Service role full access"
ON public.trial_configs
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger de updated_at
CREATE TRIGGER update_trial_configs_updated_at
BEFORE UPDATE ON public.trial_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
