# 🔧 CONFIGURAR URL NO SUPABASE - Resolver "Invalid API key"

## ⚠️ PROBLEMA

O erro "Invalid API key" pode ser causado por **URLs não configuradas** no Supabase.

---

## ✅ CONFIGURAR URLS NO SUPABASE

### PASSO 1: Acessar URL Configuration

1. Acesse: https://supabase.com/dashboard/project/zunuqaidxffuhwmvcwul
2. No menu lateral esquerdo, vá em **Authentication**
3. Clique em **"URL Configuration"** (está na seção CONFIGURATION)

---

### PASSO 2: Configurar Site URL

1. Procure por **"Site URL"**
2. **Adicione ou atualize** para:
   ```
   https://amzofertas.com.br
   ```
3. Clique em **"Save"**

---

### PASSO 3: Configurar Redirect URLs

1. Procure por **"Redirect URLs"** (ou "Redirect URLs (allowlist)")
2. **Adicione** estas URLs (uma por linha):
   ```
   https://amzofertas.com.br/**
   https://amzofertas.com.br
   http://localhost:8080/**
   http://localhost:8080
   ```
3. Clique em **"Save"**

---

### PASSO 4: Verificar se Salvou

1. Recarregue a página
2. Verifique se as URLs estão salvas
3. Se não estiverem, tente novamente

---

## 🧪 TESTAR DEPOIS

1. Limpe o cache do navegador
2. Acesse: https://amzofertas.com.br
3. Tente fazer login com: `afiliados@amzofertas.com.br`
4. Deve funcionar! ✅

---

**Configure essas URLs no Supabase e me avise se funcionou!**
