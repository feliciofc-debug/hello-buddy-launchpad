# ✅ Adicionar Secrets no Supabase

## 🎯 Service Role Key Recebida!

Agora vamos adicionar os secrets no Supabase.

---

## 📋 Passo a Passo

### 1. Ir para Edge Functions → Secrets

1. No menu lateral esquerdo, clique em **"Edge Functions"** (está na seção "CONFIGURATION")
2. Depois clique em **"Secrets"** (ou procure por "Secrets" no menu)

### 2. Adicionar Secret 1: SUPABASE_URL

1. Clique em **"Add Secret"** ou **"New Secret"** ou **"Create Secret"**
2. **Name:** `SUPABASE_URL`
3. **Value:** `https://zunuqaidxffuhwmvcwul.supabase.co`
4. Clique em **"Save"** ou **"Add"**

### 3. Adicionar Secret 2: SUPABASE_SERVICE_ROLE_KEY

1. Clique em **"Add Secret"** novamente
2. **Name:** `SUPABASE_SERVICE_ROLE_KEY`
3. **Value:** `sb_secret_7iHBiYYYurU2B1l94MbXMg_s6WCqdCC`
4. Clique em **"Save"** ou **"Add"**

### 4. Adicionar Secret 3: CONTABO_WUZAPI_ADMIN_TOKEN (Opcional)

Se você tiver o token do Wuzapi:

1. Clique em **"Add Secret"** novamente
2. **Name:** `CONTABO_WUZAPI_ADMIN_TOKEN`
3. **Value:** (cole o token do Wuzapi, se tiver)
4. Clique em **"Save"** ou **"Add"**

**Se não tiver o token, pode pular esse passo!**

---

## ✅ Verificar

Depois de adicionar, você deve ver na lista:
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ⚠️ `CONTABO_WUZAPI_ADMIN_TOKEN` (opcional)

---

## 🚀 Próximo Passo

Depois de adicionar os secrets, vamos criar a edge function!

---

**Me avise quando terminar de adicionar os secrets!** 😊
