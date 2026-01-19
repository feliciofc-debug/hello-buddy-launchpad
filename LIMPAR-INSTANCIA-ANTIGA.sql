-- ============================================
-- LIMPAR INSTÂNCIA ANTIGA DO BANCO DE DADOS
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. VER registros com instâncias (para identificar qual excluir)
SELECT 
  id,
  user_id,
  nome,
  email,
  wuzapi_token,
  wuzapi_jid,
  status,
  created_at
FROM clientes_afiliados
WHERE wuzapi_token IS NOT NULL
ORDER BY created_at DESC;

-- ============================================
-- 2. Se encontrar a instância antiga, use uma das opções abaixo:
-- ============================================

-- OPÇÃO A: Limpar por token específico
-- (Substitua 'TOKEN_AQUI' pelo token da instância excluída)
-- DELETE FROM clientes_afiliados
-- WHERE wuzapi_token = 'TOKEN_AQUI';

-- OPÇÃO B: Limpar por JID específico
-- (Substitua 'JID_AQUI' pelo JID da instância excluída)
-- DELETE FROM clientes_afiliados
-- WHERE wuzapi_jid = 'JID_AQUI';

-- OPÇÃO C: Limpar TODOS os registros (CUIDADO!)
-- DELETE FROM clientes_afiliados;
-- DELETE FROM wuzapi_tokens_afiliados;

-- ============================================
-- 3. Verificar tokens disponíveis
-- ============================================
SELECT 
  id,
  token,
  em_uso,
  cliente_afiliado_id,
  created_at
FROM wuzapi_tokens_afiliados
ORDER BY created_at DESC;

-- ============================================
-- 4. Liberar tokens que estão marcados como "em uso" mas não têm cliente
-- ============================================
UPDATE wuzapi_tokens_afiliados
SET em_uso = false,
    cliente_afiliado_id = NULL
WHERE em_uso = true 
  AND cliente_afiliado_id IS NULL;
