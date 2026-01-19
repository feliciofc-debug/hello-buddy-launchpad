# ✅ Adicionar Secrets na Edge Function

## 🎯 O Que Fazer

Adicionar as variáveis de ambiente na Edge Function `criar-instancia-wuzapi-afiliado` no Supabase.

---

## ✅ Passo a Passo

### 1. Acessar Edge Function

1. Supabase Dashboard → **Edge Functions**
2. Clique em **`criar-instancia-wuzapi-afiliado`**
3. Vá em **Settings** ou **Configurações**
4. Procure por **"Secrets"** ou **"Environment Variables"**

### 2. Adicionar Secret 1: URL_DO_PROJETO

1. Clique em **"Add Secret"** ou **"Adicionar Secret"**
2. **Name:** `URL_DO_PROJETO`
3. **Value:** `https://zunuqaidxffuhwmvcwul.supabase.co`
4. Clique em **"Save"** ou **"Salvar"**

### 3. Adicionar Secret 2: CHAVE_FUNÇÃO_DE_SERVIÇO

1. Clique em **"Add Secret"** novamente
2. **Name:** `CHAVE_FUNÇÃO_DE_SERVIÇO`
3. **Value:** Cole esta chave:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bnVxYWlkeGZmdWh3bXZjd3VsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODgyNDY2OCwiZXhwIjoyMDg0NDAwNjY4fQ.NCW24lmSQfd_RNnMUlFu9QpFKS_k2u9q5McnDcST30c
   ```
4. Clique em **"Save"** ou **"Salvar"**

### 4. Fazer Redeploy da Função

1. Depois de adicionar os secrets, procure por um botão **"Redeploy"** ou **"Redeploy Function"**
2. Clique e aguarde

---

## 📋 Checklist

- [ ] Adicionei `URL_DO_PROJETO` = `https://zunuqaidxffuhwmvcwul.supabase.co`
- [ ] Adicionei `CHAVE_FUNÇÃO_DE_SERVIÇO` = (service role key)
- [ ] Fiz Redeploy da função
- [ ] Testei no site

---

## 🎯 Resumo das Variáveis

**No Supabase (Edge Function):**
- `URL_DO_PROJETO` = `https://zunuqaidxffuhwmvcwul.supabase.co`
- `CHAVE_FUNÇÃO_DE_SERVIÇO` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bnVxYWlkeGZmdWh3bXZjd3VsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODgyNDY2OCwiZXhwIjoyMDg0NDAwNjY4fQ.NCW24lmSQfd_RNnMUlFu9QpFKS_k2u9q5McnDcST30c`

**No Vercel:**
- `VITE_SUPABASE_URL` = `https://zunuqaidxffuhwmvcwul.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bnVxYWlkeGZmdWh3bXZjd3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjQ2NjgsImV4cCI6MjA4NDQwMDY2OH0.PGDZSDZ1fc01cs8HHulK1HSSv2UHl2sHuanCwIow6L4`

---

**Adicione os secrets na Edge Function e me avise quando terminar!** 🚀
