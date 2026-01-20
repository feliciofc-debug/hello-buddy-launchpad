# 🔑 CORRIGIR API KEY - Erro "Invalid API key"

## ⚠️ PROBLEMA

O site está usando a URL correta (`zunuqaidxffuhwmvcwul.supabase.co`), mas está dando erro:
- **"Invalid API key"**
- **401 Unauthorized** no `/auth/v1/token`

Isso significa que a **chave anon** está incorreta ou não está sendo enviada.

---

## ✅ SOLUÇÃO

### PASSO 1: Pegar a Chave Anon Correta do Supabase

1. Acesse: https://supabase.com/dashboard/project/zunuqaidxffuhwmvcwul
2. Vá em **Settings** → **API**
3. Na seção **"Project API keys"**
4. Procure por **"anon public"** (não a service_role!)
5. **COPIE** a chave completa (começa com `eyJhbGci...`)

---

### PASSO 2: Atualizar no Código

A chave atual no código é:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bnVxYWlkeGZmdWh3bXZjd3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjQ2NjgsImV4cCI6MjA4NDQwMDY2OH0.PGDZSDZ1fc01cs8HHulK1HSSv2UHl2sHuanCwIow6L4
```

**Me envie a chave que aparece no Supabase** para eu atualizar no código.

---

### PASSO 3: Atualizar no Vercel

1. Acesse: https://vercel.com
2. Vá no seu projeto
3. **Settings** → **Environment Variables**
4. Procure por `VITE_SUPABASE_ANON_KEY`
5. **Atualize** com a chave correta do Supabase
6. **Salve**
7. Faça **Redeploy** (sem cache)

---

## 🔍 VERIFICAR

A chave anon deve:
- Começar com `eyJhbGci...`
- Ser a chave **"anon public"** (não service_role)
- Estar no projeto **zunuqaidxffuhwmvcwul**

---

**Me envie a chave anon que aparece no Supabase Dashboard para eu atualizar!**
