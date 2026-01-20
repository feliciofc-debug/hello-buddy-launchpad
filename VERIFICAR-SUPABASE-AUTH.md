# 🔍 VERIFICAR CONFIGURAÇÃO SUPABASE - Erro "Invalid API key"

## ⚠️ PROBLEMA

A chave está correta no Vercel, mas ainda dá erro "Invalid API key". Isso pode ser:

1. **Configuração de autenticação no Supabase**
2. **Bundle ainda com chave antiga compilada**
3. **Problema de CORS ou Site URL**

---

## ✅ VERIFICAR SUPABASE

### PASSO 1: Verificar Authentication Settings

1. Acesse: https://supabase.com/dashboard/project/zunuqaidxffuhwmvcwul
2. Vá em **Authentication** → **Settings** (ou **URL Configuration**)
3. Verifique:

   **Site URL:**
   - Deve ter: `https://amzofertas.com.br`
   - Se não tiver, **adicione**

   **Redirect URLs:**
   - Deve ter: `https://amzofertas.com.br/**`
   - Deve ter: `http://localhost:8080/**` (para testes)
   - Se não tiver, **adicione**

---

### PASSO 2: Verificar API Settings

1. Vá em **Settings** → **API**
2. Verifique se a chave **"anon public"** está ativa
3. Verifique se não há restrições de CORS

---

### PASSO 3: Forçar Redeploy no Vercel (SEM CACHE)

1. Vercel → **Deployments**
2. Último deploy → **3 pontinhos** → **"Redeploy"**
3. **⚠️ DESMARQUE** "Use existing Build Cache"
4. Clique em **"Redeploy"**
5. Aguarde terminar

---

### PASSO 4: Limpar Cache e Testar

1. **Limpe cache do navegador** (Ctrl + Shift + Delete)
2. **Feche e reabra** o navegador
3. Acesse: https://amzofertas.com.br
4. Abra o Console (F12)
5. Tente fazer login
6. Veja o erro exato no Console

---

## 🔍 ME ENVIE

1. **O que aparece no Console** quando tenta fazer login (erro completo)
2. **Se o Site URL e Redirect URLs** estão configurados no Supabase
3. **Se fez o redeploy sem cache** no Vercel

---

**Verifique essas configurações e me diga o que encontrou!**
