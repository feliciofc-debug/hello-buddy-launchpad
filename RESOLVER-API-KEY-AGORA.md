# 🔑 RESOLVER "Invalid API key" - PASSO A PASSO

## ✅ O QUE FAZER AGORA

### PASSO 1: Atualizar no Vercel (2 minutos)

1. **Acesse:** https://vercel.com
2. **Vá no seu projeto**
3. **Settings** → **Environment Variables**
4. **Procure por:** `VITE_SUPABASE_ANON_KEY`
5. **Se existir:**
   - Clique nos **3 pontinhos** → **"Edit"**
   - **APAGUE** tudo que está lá
   - **COLE** esta chave:
     ```
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bnVxYWlkeGZmdWh3bXZjd3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjQ2NjgsImV4cCI6MjA4NDQwMDY2OH0.PGDZSDZ1fc01cs8HHulK1HSSv2UHl2sHuanCwIow6L4
     ```
   - Clique em **"Save"**
6. **Se NÃO existir:**
   - Clique em **"Add New"**
   - **Key:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** Cole a chave acima
   - Marque: **Production**, **Preview**, **Development**
   - Clique em **"Save"**

---

### PASSO 2: Verificar VITE_SUPABASE_URL

1. Na mesma página, procure por `VITE_SUPABASE_URL`
2. Deve ser: `https://zunuqaidxffuhwmvcwul.supabase.co`
3. Se estiver diferente, **atualize** também

---

### PASSO 3: Redeploy SEM CACHE (IMPORTANTE!)

1. Vá em **"Deployments"**
2. Clique no **último deploy** (o mais recente)
3. Clique nos **3 pontinhos** (canto superior direito)
4. Clique em **"Redeploy"**
5. **⚠️ DESMARQUE** "Use existing Build Cache" (muito importante!)
6. Clique em **"Redeploy"**
7. **Aguarde** terminar (2-3 minutos)

---

### PASSO 4: Testar no Site

1. **Limpe o cache do navegador:**
   - Pressione **Ctrl + Shift + Delete**
   - Marque **"Imagens e arquivos em cache"**
   - Período: **"Todo o período"**
   - Clique em **"Limpar dados"**
2. **Feche e reabra o navegador**
3. Acesse: **https://amzofertas.com.br**
4. Tente fazer **login**
5. Deve funcionar! ✅

---

## 📋 CHECKLIST

- [ ] Atualizei `VITE_SUPABASE_ANON_KEY` no Vercel
- [ ] Verifiquei que `VITE_SUPABASE_URL` está correto
- [ ] Fiz Redeploy **SEM CACHE** (desmarquei a opção)
- [ ] Limpei o cache do navegador
- [ ] Testei fazer login

---

**Siga os 4 passos acima e me avise se funcionou!**
