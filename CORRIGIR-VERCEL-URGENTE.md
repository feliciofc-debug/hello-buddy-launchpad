# 🚨 CORRIGIR VERCEL URGENTE - Site ainda usa URL antiga

## ⚠️ PROBLEMA

O projeto foi deletado, mas o site em produção (`amzofertas.com.br`) ainda está tentando usar `zunuqaidxffuhwmvcwul.supabase.co`.

**Erro no console:**
```
ERR_NAME_NOT_RESOLVED zunuqaidxffuhwmvcwul
POST https://zunuqaidxffuhwmvcwul.supabase.co/auth/v1/token 401
```

---

## ✅ SOLUÇÃO: 3 PASSOS OBRIGATÓRIOS

### PASSO 1: Verificar Variáveis no Vercel (CRÍTICO!)

1. Acesse: https://vercel.com
2. Vá no seu projeto → **Settings** → **Environment Variables**
3. **VERIFIQUE** se tem:
   - `VITE_SUPABASE_URL` = `https://jibpvpqgplmahjhswiza.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYnB2cHFncGxtYWhqaHN3aXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODA0ODcsImV4cCI6MjA3NjE1NjQ4N30.raNfZtKkNUZBHiAA6yobri0YoWZt_Ioq10qMC9hfNrcr`
4. **SE ESTIVER DIFERENTE:**
   - DELETE a variável antiga
   - ADICIONE a nova
   - **SALVE**

---

### PASSO 2: Forçar Redeploy SEM CACHE (OBRIGATÓRIO!)

1. Vercel → **Deployments**
2. Último deploy → **3 pontinhos** (⋮) → **"Redeploy"**
3. **⚠️ CRÍTICO: DESMARQUE** "Use existing Build Cache"
4. Clique em **"Redeploy"**
5. Aguarde terminar (2-3 minutos)

---

### PASSO 3: Limpar Cache do Navegador

1. Pressione **Ctrl + Shift + Delete**
2. Selecione **"Imagens e arquivos em cache"**
3. Período: **"Todo o período"**
4. Clique em **"Limpar dados"**
5. Feche e reabra o navegador
6. Acesse: https://amzofertas.com.br

---

## 🔍 VERIFICAR SE FUNCIONOU

1. Abra o Console (F12)
2. Procure por:
   ```
   🔧 [SUPABASE CLIENT] Inicializando com URL: https://jibpvpqgplmahjhswiza.supabase.co
   ```
3. **NÃO deve aparecer** `zunuqaidxffuhwmvcwul` em nenhuma requisição
4. Tente fazer login

---

## ⚠️ SE AINDA NÃO FUNCIONAR

O problema pode ser que o Vercel está usando variáveis de ambiente antigas. Nesse caso:

1. Vercel → **Settings** → **Environment Variables**
2. **DELETE TODAS** as variáveis relacionadas a Supabase
3. **ADICIONE NOVAMENTE** com os valores corretos:
   - `VITE_SUPABASE_URL` = `https://jibpvpqgplmahjhswiza.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYnB2cHFncGxtYWhqaHN3aXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODA0ODcsImV4cCI6MjA3NjE1NjQ4N30.raNfZtKkNUZBHiAA6yobri0YoWZt_Ioq10qMC9hfNrcr`
4. **SALVE**
5. Faça o redeploy novamente (sem cache)

---

**Faça isso AGORA e me avise o resultado!**
