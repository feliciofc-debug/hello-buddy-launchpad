# ✅ Atualizar Chave Anon no Vercel

## 🎯 O Que Atualizar

### Variável: `VITE_SUPABASE_ANON_KEY`

**Valor CORRETO (cole este):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bnVxYWlkeGZmdWh3bXZjd3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjQ2NjgsImV4cCI6MjA4NDQwMDY2OH0.PGDZSDZ1fc01cs8HHulK1HSSv2UHl2sHuanCwIow6L4
```

---

## ✅ Passo a Passo

### 1. Acessar Vercel

1. Vercel Dashboard → Seu Projeto → **Settings** → **Environment Variables**

### 2. Encontrar `VITE_SUPABASE_ANON_KEY`

1. Procure por `VITE_SUPABASE_ANON_KEY` (ou `VITE_SUPABASE_PUBLISHABLE_KEY`)
2. Se encontrar, clique nos **3 pontinhos** (⋯) → **Edit**
3. Se NÃO encontrar, clique em **"Add New"**

### 3. Atualizar o Valor

1. **Nome:** `VITE_SUPABASE_ANON_KEY`
2. **Value:** Cole esta chave completa:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bnVxYWlkeGZmdWh3bXZjd3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjQ2NjgsImV4cCI6MjA4NDQwMDY2OH0.PGDZSDZ1fc01cs8HHulK1HSSv2UHl2sHuanCwIow6L4
   ```
3. Marque: ✅ **Production**, ✅ **Preview**, ✅ **Development**
4. Clique em **"Save"**

### 4. Verificar `VITE_SUPABASE_URL` Também

Certifique-se de que está:
- **Nome:** `VITE_SUPABASE_URL`
- **Value:** `https://zunuqaidxffuhwmvcwul.supabase.co`

### 5. Fazer Redeploy (OBRIGATÓRIO!)

1. Vá em **"Deployments"**
2. Clique nos **3 pontinhos** (⋯) do último deploy
3. Clique em **"Redeploy"**
4. **AGUARDE** terminar (1-2 minutos)

---

## 📋 Checklist

- [ ] Atualizei `VITE_SUPABASE_ANON_KEY` no Vercel
- [ ] Verifiquei que `VITE_SUPABASE_URL` está correto
- [ ] Fiz Redeploy no Vercel
- [ ] Aguardei o deploy terminar

---

**Atualize no Vercel e faça o Redeploy!** 🚀
