
-- =====================================================
-- SISTEMA WHATSAPP PJ - TABELAS COMPLETAS
-- Espelho do sistema Afiliados (100% preservado)
-- =====================================================

-- 1. Configuração dos clientes PJ (conexão WhatsApp)
CREATE TABLE IF NOT EXISTS public.pj_clientes_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wuzapi_token TEXT,
  wuzapi_jid TEXT,
  wuzapi_instance_name TEXT,
  wuzapi_port INTEGER DEFAULT 8080,
  nome_assistente TEXT DEFAULT 'Assistente Virtual',
  personalidade_assistente TEXT DEFAULT 'profissional e prestativo',
  whatsapp_conectado BOOLEAN DEFAULT false,
  ultimo_status_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Grupos WhatsApp sincronizados
CREATE TABLE IF NOT EXISTS public.pj_grupos_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  grupo_jid TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  participantes_count INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT false,
  is_announce BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  ultimo_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, grupo_jid)
);

-- 3. Listas de transmissão (categorias)
CREATE TABLE IF NOT EXISTS public.pj_listas_categoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#3B82F6',
  icone TEXT DEFAULT 'users',
  ativa BOOLEAN DEFAULT true,
  total_membros INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Membros das listas
CREATE TABLE IF NOT EXISTS public.pj_lista_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id UUID REFERENCES public.pj_listas_categoria(id) ON DELETE CASCADE,
  lead_id UUID,
  telefone TEXT,
  nome TEXT,
  adicionado_em TIMESTAMPTZ DEFAULT now()
);

-- 5. Campanhas programadas
CREATE TABLE IF NOT EXISTS public.pj_campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  mensagem_template TEXT NOT NULL,
  produto_id UUID,
  listas_ids UUID[],
  grupos_ids UUID[],
  data_inicio TIMESTAMPTZ NOT NULL,
  horarios TEXT[] DEFAULT ARRAY['09:00'],
  dias_semana INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
  frequencia TEXT DEFAULT 'diaria',
  ativa BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'ativa',
  total_enviados INTEGER DEFAULT 0,
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Envios programados (agendador automático)
CREATE TABLE IF NOT EXISTS public.pj_envios_programados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  grupo_id UUID REFERENCES public.pj_grupos_whatsapp(id) ON DELETE CASCADE,
  grupo_jid TEXT,
  grupo_nome TEXT,
  categorias TEXT[] DEFAULT ARRAY[]::TEXT[],
  modo_selecao TEXT DEFAULT 'rotativo',
  intervalo_minutos INTEGER DEFAULT 30,
  horario_inicio TIME DEFAULT '08:00',
  horario_fim TIME DEFAULT '22:00',
  dias_ativos INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
  ativo BOOLEAN DEFAULT true,
  pausado BOOLEAN DEFAULT false,
  ultimo_envio TIMESTAMPTZ,
  proximo_envio TIMESTAMPTZ,
  ultimo_produto_id UUID,
  total_enviados INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Histórico de envios
CREATE TABLE IF NOT EXISTS public.pj_historico_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  programacao_id UUID REFERENCES public.pj_envios_programados(id) ON DELETE SET NULL,
  campanha_id UUID REFERENCES public.pj_campanhas(id) ON DELETE SET NULL,
  grupo_jid TEXT,
  grupo_nome TEXT,
  produto_id UUID,
  produto_titulo TEXT,
  mensagem TEXT,
  imagem_url TEXT,
  status TEXT DEFAULT 'enviado',
  erro TEXT,
  enviado_em TIMESTAMPTZ DEFAULT now()
);

-- 8. Histórico de conversas da IA
CREATE TABLE IF NOT EXISTS public.pj_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  phone TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Estado da conversa (máquina de estados)
CREATE TABLE IF NOT EXISTS public.pj_user_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  phone TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'idle',
  state JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Configuração do assistente IA
CREATE TABLE IF NOT EXISTS public.pj_ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  nome_assistente TEXT DEFAULT 'Assistente Virtual',
  personalidade TEXT DEFAULT 'profissional, prestativo e objetivo',
  regras_customizadas TEXT,
  palavras_transferir TEXT[] DEFAULT ARRAY['humano', 'atendente', 'pessoa'],
  mensagem_boas_vindas TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Fila de atendimento (anti-bloqueio)
CREATE TABLE IF NOT EXISTS public.fila_atendimento_pj (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  phone TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  imagem_url TEXT,
  prioridade INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pendente',
  tentativas INTEGER DEFAULT 0,
  max_tentativas INTEGER DEFAULT 3,
  delay_segundos INTEGER DEFAULT 5,
  erro TEXT,
  processado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Deduplicação de webhooks
CREATE TABLE IF NOT EXISTS public.pj_webhook_dedup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  instance_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pj_webhook_dedup_message ON public.pj_webhook_dedup(message_id);
CREATE INDEX IF NOT EXISTS idx_pj_conversas_phone ON public.pj_conversas(phone);
CREATE INDEX IF NOT EXISTS idx_pj_user_states_phone ON public.pj_user_states(phone);
CREATE INDEX IF NOT EXISTS idx_fila_atendimento_pj_status ON public.fila_atendimento_pj(status);
CREATE INDEX IF NOT EXISTS idx_pj_envios_programados_proximo ON public.pj_envios_programados(proximo_envio) WHERE ativo = true;

-- RLS para todas as tabelas
ALTER TABLE public.pj_clientes_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_grupos_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_listas_categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_lista_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_envios_programados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_historico_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_user_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fila_atendimento_pj ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_webhook_dedup ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "pj_clientes_config_user" ON public.pj_clientes_config FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pj_grupos_whatsapp_user" ON public.pj_grupos_whatsapp FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pj_listas_categoria_user" ON public.pj_listas_categoria FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pj_campanhas_user" ON public.pj_campanhas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pj_envios_programados_user" ON public.pj_envios_programados FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pj_historico_envios_user" ON public.pj_historico_envios FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pj_ai_config_user" ON public.pj_ai_config FOR ALL USING (auth.uid() = user_id);

-- Políticas para Edge Functions
CREATE POLICY "pj_conversas_service" ON public.pj_conversas FOR ALL USING (true);
CREATE POLICY "pj_user_states_service" ON public.pj_user_states FOR ALL USING (true);
CREATE POLICY "fila_atendimento_pj_service" ON public.fila_atendimento_pj FOR ALL USING (true);
CREATE POLICY "pj_webhook_dedup_service" ON public.pj_webhook_dedup FOR ALL USING (true);
CREATE POLICY "pj_lista_membros_service" ON public.pj_lista_membros FOR ALL USING (true);
