# 🔍 Verificar Banco de Dados - Instância Excluída

## 🔴 Problema

Você excluiu uma instância do Wuzapi, mas o sistema ainda está tentando conectar nela.

**Isso acontece porque:**
- A instância foi excluída no **Wuzapi** (servidor)
- Mas os **dados ainda estão no banco de dados Supabase** (tabela `clientes_afiliados`)

---

## ✅ Solução: Limpar Dados do Banco

### Opção 1: Verificar no Supabase Dashboard

1. No Supabase Dashboard, vá em **"Database"** → **"Tables"**
2. Clique na tabela: **`clientes_afiliados`**
3. Veja se há registros com:
   - `wuzapi_token` = token da instância excluída
   - `wuzapi_jid` = JID da instância excluída
4. Se encontrar, **delete esses registros**

### Opção 2: Usar SQL Editor (Mais Rápido)

1. No Supabase Dashboard, vá em **"SQL Editor"**
2. Cole este código SQL:

```sql
-- Ver registros com instâncias antigas
SELECT 
  id,
  user_id,
  nome,
  email,
  wuzapi_token,
  wuzapi_jid,
  status
FROM clientes_afiliados
WHERE wuzapi_token IS NOT NULL
ORDER BY created_at DESC;
```

3. Clique em **"Run"**
4. Veja os registros que aparecem
5. Se encontrar a instância excluída, delete:

```sql
-- CUIDADO: Substitua 'TOKEN_DA_INSTANCIA_EXCLUIDA' pelo token real
DELETE FROM clientes_afiliados
WHERE wuzapi_token = 'TOKEN_DA_INSTANCIA_EXCLUIDA';
```

### Opção 3: Limpar Tudo (Se Não Precisar de Nenhum Dado)

**⚠️ CUIDADO:** Isso apaga TODOS os registros!

```sql
-- Limpar TODOS os clientes afiliados
DELETE FROM clientes_afiliados;

-- Limpar TODOS os tokens
DELETE FROM wuzapi_tokens_afiliados;
```

---

## 🔍 Como Identificar a Instância Excluída

1. No console do navegador (F12), procure por:
   - `wuzapi_token`
   - `wuzapi_jid`
   - Mensagens de erro com token/JID

2. Ou verifique no Wuzapi Dashboard:
   - Veja quais instâncias existem
   - Compare com o que está no banco

---

## 📋 Checklist

- [ ] Acessei Supabase Dashboard → Database → Tables
- [ ] Verifiquei a tabela `clientes_afiliados`
- [ ] Encontrei registros com instâncias antigas
- [ ] Deletei os registros da instância excluída
- [ ] Testei o site novamente

---

## 🎯 Depois de Limpar

1. Acesse o site
2. Tente criar uma **nova instância**
3. O sistema deve criar uma instância nova e limpa

---

**Verifique o banco de dados e me avise o que encontrou!** 🚀
