-- ═══════════════════════════════════════════════════════
-- MIGRAÇÃO: Sistema Multi-Cliente
-- Renomeia "lojas" para "clientes" e adiciona novos campos
-- ═══════════════════════════════════════════════════════

-- 1. Criar nova tabela "clientes" com todos os campos necessários
CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  tipo_negocio text,
  logo_url text,
  cor_marca text,
  instagram text,
  facebook text,
  descricao text,
  contato text,
  email text,
  telefone text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Copiar dados da tabela "lojas" para "clientes" (se existir)
INSERT INTO public.clientes (
  id, user_id, nome, descricao, contato, email, telefone, ativo, created_at, updated_at
)
SELECT 
  id, user_id, nome, descricao, contato, email, telefone, ativo, created_at, updated_at
FROM public.lojas
ON CONFLICT (id) DO NOTHING;

-- 3. Atualizar tabela produtos - renomear loja_id para cliente_id
ALTER TABLE public.produtos 
  DROP CONSTRAINT IF EXISTS produtos_loja_id_fkey;

ALTER TABLE public.produtos 
  RENAME COLUMN loja_id TO cliente_id;

ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_cliente_id_fkey 
  FOREIGN KEY (cliente_id) 
  REFERENCES public.clientes(id) 
  ON DELETE SET NULL;

-- 4. Criar trigger para atualizar updated_at em clientes
CREATE OR REPLACE FUNCTION update_clientes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clientes_updated_at_trigger
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_clientes_updated_at();

-- 5. Habilitar RLS na tabela clientes
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS para clientes
CREATE POLICY "Usuários podem ver seus próprios clientes"
  ON public.clientes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios clientes"
  ON public.clientes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios clientes"
  ON public.clientes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios clientes"
  ON public.clientes
  FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Atualizar políticas RLS da tabela produtos (agora usando cliente_id)
DROP POLICY IF EXISTS "Empresas podem ver seus próprios produtos" ON public.produtos;
DROP POLICY IF EXISTS "Empresas podem criar seus próprios produtos" ON public.produtos;
DROP POLICY IF EXISTS "Empresas podem atualizar seus próprios produtos" ON public.produtos;
DROP POLICY IF EXISTS "Empresas podem deletar seus próprios produtos" ON public.produtos;

CREATE POLICY "Usuários podem ver produtos próprios e de clientes"
  ON public.produtos
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar produtos próprios e de clientes"
  ON public.produtos
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      cliente_id IS NULL OR
      cliente_id IN (
        SELECT id FROM public.clientes WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Usuários podem atualizar produtos próprios e de clientes"
  ON public.produtos
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar produtos próprios e de clientes"
  ON public.produtos
  FOR DELETE
  USING (
    auth.uid() = user_id OR
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

-- 8. Remover a tabela lojas antiga (dados já foram copiados)
DROP TABLE IF EXISTS public.lojas CASCADE;