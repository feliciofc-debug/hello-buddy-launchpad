# 🚨 FORÇAR DEPLOY NO VERCEL - URGENTE

## ⚠️ PROBLEMA

O site em produção ainda está usando a URL antiga `zunuqaidxffuhwmvcwul` mesmo depois das correções.

---

## ✅ SOLUÇÃO: 2 PASSOS

### PASSO 1: Verificar Variáveis no Vercel

1. Acesse: https://vercel.com
2. Vá no seu projeto → **Settings** → **Environment Variables**
3. **DELETE** todas as variáveis que tenham `zunuqaidxffuhwmvcwul`
4. **ADICIONE/ATUALIZE** com:
   - `VITE_SUPABASE_URL` = `https://jibpvpqgplmahjhswiza.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYnB2cHFncGxtYWhqaHN3aXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODA0ODcsImV4cCI6MjA3NjE1NjQ4N30.raNfZtKkNUZBHiAA6yobri0YoWZt_Ioq10qMC9hfNrcr`
5. **SALVE**

---

### PASSO 2: Forçar Redeploy SEM CACHE

1. Vercel → **Deployments**
2. Último deploy → **3 pontinhos** (⋮) → **"Redeploy"**
3. **⚠️ CRÍTICO: DESMARQUE** "Use existing Build Cache"
4. Clique em **"Redeploy"**
5. Aguarde terminar (2-3 minutos)

---

## 🔍 DEPOIS DO DEPLOY

1. Limpe o cache do navegador (Ctrl + Shift + Delete)
2. Acesse: https://amzofertas.com.br
3. Abra o Console (F12)
4. Procure por:
   ```
   🔧 [SUPABASE CLIENT] Inicializando com URL: https://jibpvpqgplmahjhswiza.supabase.co
   ```
5. **NÃO deve aparecer** `zunuqaidxffuhwmvcwul` em nenhuma requisição

---

**Faça isso AGORA e me avise quando terminar!**
