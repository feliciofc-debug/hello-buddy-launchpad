# 🔍 Sem Logs - Verificações Necessárias

## ⚠️ Problema

Os logs estão vazios, mas o erro 500 está acontecendo. Isso pode significar:
- A função está falhando antes de gerar logs
- Os logs podem estar em outro lugar
- O filtro de tempo está muito restritivo

---

## ✅ Verificações

### 1. Mudar Filtro de Tempo

1. Na aba "Registros" (Logs)
2. Procure por **"Last hour"** ou filtro de tempo
3. Mude para **"Last 24 hours"** ou **"All time"**
4. Veja se aparecem logs

### 2. Verificar Aba "Invocações"

1. Clique na aba **"Invocações"** (Invocations)
2. Veja se há tentativas de chamar a função
3. Clique em alguma invocação para ver detalhes

### 3. Verificar Secrets

1. Vá em **Edge Functions** → **Secrets**
2. Verifique se estão configurados:
   - ✅ `URL_DO_PROJETO`
   - ✅ `CHAVE_FUNÇÃO_DE_SERVIÇO`

### 4. Verificar se Tabelas Existem

O erro 500 pode ser porque as tabelas não existem no novo projeto:

1. No Supabase Dashboard, vá em **Database** → **Tables**
2. Verifique se existem:
   - `clientes_afiliados`
   - `wuzapi_tokens_afiliados`

---

## 🔍 Possível Causa

**As tabelas provavelmente não existem no novo projeto!**

O novo projeto Supabase está vazio. Precisamos criar as tabelas ou migrar os dados.

---

**Me diga:**
1. As tabelas existem no novo projeto?
2. Apareceu algo na aba "Invocações"?
