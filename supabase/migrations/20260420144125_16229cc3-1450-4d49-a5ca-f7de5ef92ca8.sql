-- A) Adicionar flag de modo personalizado na tabela produtos
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS usa_textos_personalizados BOOLEAN NOT NULL DEFAULT false;

-- B) Limpar textos globais existentes (recomeçar zerado por produto)
DELETE FROM public.autopilot_textos_personalizados;

-- C) Adicionar produto_id (FK) na tabela de textos
ALTER TABLE public.autopilot_textos_personalizados
  ADD COLUMN IF NOT EXISTS produto_id UUID NOT NULL
    REFERENCES public.produtos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_autopilot_textos_produto
  ON public.autopilot_textos_personalizados(produto_id, ativo);

-- D) Tabela de notificações pro cliente
CREATE TABLE IF NOT EXISTS public.notificacoes_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  lida BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users veem suas notificações"
  ON public.notificacoes_usuario FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users atualizam suas notificações"
  ON public.notificacoes_usuario FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role insere notificações"
  ON public.notificacoes_usuario FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_user_lida 
  ON public.notificacoes_usuario(user_id, lida, created_at DESC);