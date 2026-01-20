# 🔍 DIAGNOSTICAR ERRO API KEY - Projeto Lovable

## ⚠️ PROBLEMA

Ainda está dando erro "Invalid API key" mesmo com as credenciais da Lovable.

---

## ✅ VERIFICAR PASSO A PASSO

### PASSO 1: Verificar Código Local

O código deve ter:
- URL: `https://jibpvpqgplmahjhswiza.supabase.co`
- Chave: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYnB2cHFncGxtYWhqaHN3aXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODA0ODcsImV4cCI6MjA3NjE1NjQ4N30.raNfZtKkNUZBHiAA6yobri0YoWZt_Ioq10qMC9hfNrcr`

---

### PASSO 2: Verificar Vercel (CRÍTICO!)

1. Acesse: https://vercel.com
2. Vá no seu projeto → **Settings** → **Environment Variables**
3. Verifique se tem:
   - `VITE_SUPABASE_URL` = `https://jibpvpqgplmahjhswiza.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYnB2cHFncGxtYWhqaHN3aXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODA0ODcsImV4cCI6MjA3NjE1NjQ4N30.raNfZtKkNUZBHiAA6yobri0YoWZt_Ioq10qMC9hfNrcr`
4. Se estiver diferente, **ATUALIZE** e **SALVE**

---

### PASSO 3: Forçar Redeploy SEM CACHE

1. Vercel → **Deployments**
2. Último deploy → **3 pontinhos** → **"Redeploy"**
3. **⚠️ DESMARQUE** "Use existing Build Cache"
4. Clique em **"Redeploy"**
5. Aguarde terminar (2-3 minutos)

---

### PASSO 4: Verificar no Console do Site

1. Limpe o cache do navegador (Ctrl + Shift + Delete)
2. Acesse: https://amzofertas.com.br
3. Abra o Console (F12)
4. Procure por:
   ```
   🔧 [SUPABASE CLIENT] Inicializando com URL: https://jibpvpqgplmahjhswiza.supabase.co
   ```
5. Tente fazer login
6. Veja o erro exato no Console

---

## 🔍 ME ENVIE

1. **O que aparece no Console** quando abre o site (mensagens de inicialização)
2. **O erro exato** quando tenta fazer login
3. **Se as variáveis no Vercel** estão corretas
4. **Se fez o redeploy sem cache**

---

**Verifique essas coisas e me diga o que encontrou!**
