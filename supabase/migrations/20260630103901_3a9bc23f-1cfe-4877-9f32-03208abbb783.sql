
-- ============================================================
-- 1) VENDEDORES: hash bcrypt + RPC + RLS fechada + drop senha
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1a. Adiciona coluna senha_hash
ALTER TABLE public.vendedores ADD COLUMN IF NOT EXISTS senha_hash TEXT;

-- 1b. Backfill: hash bcrypt da senha atual (preserva login dos vendedores)
UPDATE public.vendedores
SET senha_hash = crypt(senha, gen_salt('bf', 10))
WHERE senha IS NOT NULL AND senha_hash IS NULL;

-- 1c. Tornar senha_hash NOT NULL daqui pra frente
ALTER TABLE public.vendedores ALTER COLUMN senha_hash SET NOT NULL;

-- 1d. RPC de login: SECURITY DEFINER, retorna dados do vendedor se senha bater
CREATE OR REPLACE FUNCTION public.vendedor_login(p_email TEXT, p_senha TEXT)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  email TEXT,
  especialidade TEXT,
  whatsapp TEXT,
  ativo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.nome, v.email, v.especialidade, v.whatsapp, v.ativo
  FROM public.vendedores v
  WHERE v.email = lower(trim(p_email))
    AND v.ativo = true
    AND v.senha_hash = crypt(p_senha, v.senha_hash)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendedor_login(TEXT, TEXT) TO anon, authenticated;

-- 1e. RPC de recuperação de senha: gera nova, hasheia, retorna a nova senha em texto
--     (só pra ser enviada via WhatsApp — não fica armazenada em texto)
CREATE OR REPLACE FUNCTION public.vendedor_resetar_senha(p_email TEXT)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  whatsapp TEXT,
  nova_senha TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_nova_senha TEXT;
  v_id UUID;
  v_nome TEXT;
  v_whatsapp TEXT;
BEGIN
  SELECT v.id, v.nome, v.whatsapp INTO v_id, v_nome, v_whatsapp
  FROM public.vendedores v
  WHERE v.email = lower(trim(p_email)) AND v.ativo = true
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  -- gera senha aleatória de 8 chars
  v_nova_senha := substr(encode(gen_random_bytes(6), 'base64'), 1, 8);

  UPDATE public.vendedores
  SET senha_hash = crypt(v_nova_senha, gen_salt('bf', 10))
  WHERE id = v_id;

  RETURN QUERY SELECT v_id, v_nome, v_whatsapp, v_nova_senha;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendedor_resetar_senha(TEXT) TO anon, authenticated;

-- 1f. RPC para cadastro: aceita senha em texto, salva hasheada
CREATE OR REPLACE FUNCTION public.vendedor_definir_senha(p_vendedor_id UUID, p_senha TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;
  UPDATE public.vendedores
  SET senha_hash = crypt(p_senha, gen_salt('bf', 10))
  WHERE id = p_vendedor_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendedor_definir_senha(UUID, TEXT) TO authenticated;

-- 1g. FECHAR RLS: drop policies abertas, recriar restritas
DROP POLICY IF EXISTS "Vendedores podem fazer login" ON public.vendedores;
DROP POLICY IF EXISTS "Usuários podem ver vendedores da empresa" ON public.vendedores;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir vendedores" ON public.vendedores;
DROP POLICY IF EXISTS "Usuários podem atualizar vendedores" ON public.vendedores;
DROP POLICY IF EXISTS "Usuários podem deletar vendedores" ON public.vendedores;

-- Authenticated pode ler/inserir/atualizar/deletar metadados (NÃO inclui senha pq vai sumir)
CREATE POLICY "Authenticated gerencia vendedores"
ON public.vendedores
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Revoga acesso direto à tabela do anon (login passa pela RPC)
REVOKE ALL ON public.vendedores FROM anon;

-- 1h. DROP da coluna senha em texto puro
ALTER TABLE public.vendedores DROP COLUMN IF EXISTS senha;

-- ============================================================
-- 2) _BACKUP_BILLING: drop (CSV já exportado para área privada)
-- ============================================================
DROP TABLE IF EXISTS public._backup_billing_fase1_20260427;
