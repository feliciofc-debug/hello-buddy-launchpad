# ✅ Corrigir Edge Function - Sugestão do Kimi

## 🎯 O Problema

A Edge Function `criar-instancia-wuzapi-afiliado` precisa ter as variáveis de ambiente configuradas **no Supabase Dashboard**, não só no Vercel!

---

## ✅ Solução (30 segundos)

### 1. Acessar Edge Function no Supabase

1. Supabase Dashboard → **Edge Functions**
2. Clique em **`criar-instancia-wuzapi-afiliado`**
3. Vá em **Settings** ou **Configurações**
4. Procure por **"Environment Variables"** ou **"Variáveis de Ambiente"**

### 2. Adicionar/Atualizar Variáveis

Adicione ou atualize estas variáveis:

**Nome:** `URL_DO_PROJETO`  
**Valor:** `https://zunuqaidxffuhwmvcwul.supabase.co`

**Nome:** `CHAVE_FUNÇÃO_DE_SERVIÇO`  
**Valor:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (a service role key do novo projeto)

### 3. Salvar e Redeploy

1. Clique em **"Save"** ou **"Salvar"**
2. Procure por um botão **"Redeploy"** ou **"Redeploy Function"**
3. Clique e aguarde

---

## 🔍 Onde Pegar a Service Role Key

1. Supabase Dashboard → **Settings** → **API**
2. Procure por **"service_role"** (não a "anon"!)
3. Copie a chave completa

---

## 📋 Checklist

- [ ] Acessei Edge Functions → criar-instancia-wuzapi-afiliado → Settings
- [ ] Adicionei `URL_DO_PROJETO` = `https://zunuqaidxffuhwmvcwul.supabase.co`
- [ ] Adicionei `CHAVE_FUNÇÃO_DE_SERVIÇO` = (service role key)
- [ ] Salvei as variáveis
- [ ] Fiz Redeploy da função
- [ ] Testei no site

---

**Isso deve resolver o erro 500!** 🚀
