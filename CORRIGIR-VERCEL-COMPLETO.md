# ✅ Corrigir TODAS as Variáveis no Vercel

## 🎯 O Que Precisa Estar no Vercel

### Variáveis Obrigatórias:

1. **`VITE_SUPABASE_URL`**
   - Valor: `https://zunuqaidxffuhwmvcwul.supabase.co`

2. **`VITE_SUPABASE_ANON_KEY`** (ou `VITE_SUPABASE_PUBLISHABLE_KEY`)
   - Valor: A chave **"anon / public"** do novo projeto
   - Onde pegar: Supabase Dashboard → Settings → API → "anon / public"

---

## ✅ Passo a Passo

### 1. Pegar a Chave Anon do Novo Projeto

1. Supabase Dashboard → Settings → API
2. Procure por **"anon / public"**
3. Clique em **"Copy"** para copiar
4. **Cole em um lugar seguro**

### 2. Atualizar no Vercel

1. Vercel Dashboard → Seu Projeto → **Settings** → **Environment Variables**

2. **Verificar/Atualizar `VITE_SUPABASE_URL`:**
   - Se existir, edite
   - Se não existir, adicione
   - **Valor:** `https://zunuqaidxffuhwmvcwul.supabase.co`
   - Marque: Production, Preview, Development
   - Salve

3. **Verificar/Atualizar `VITE_SUPABASE_ANON_KEY`:**
   - Se existir, edite
   - Se não existir, adicione
   - **Valor:** (cole a chave "anon / public" que você copiou)
   - Marque: Production, Preview, Development
   - Salve

### 3. Fazer Redeploy

1. Vercel Dashboard → **Deployments**
2. Clique nos **3 pontinhos** do último deploy
3. Clique em **"Redeploy"**
4. Aguarde terminar

---

## 📋 Checklist

- [ ] Peguei a chave "anon / public" do novo projeto
- [ ] Atualizei `VITE_SUPABASE_URL` no Vercel
- [ ] Atualizei `VITE_SUPABASE_ANON_KEY` no Vercel
- [ ] Fiz Redeploy no Vercel
- [ ] Testei o site

---

**Depois de corrigir, me avise!** 🚀
