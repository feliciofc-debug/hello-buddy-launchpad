# 🔍 Verificar Projeto Supabase no Vercel

## 🎯 Método Mais Fácil: Ver no Vercel!

Se o Supabase já está configurado no Vercel, podemos ver qual projeto está sendo usado pelas variáveis de ambiente.

---

## 📋 Passo a Passo

### 1. Acessar o Vercel Dashboard

1. Vá para: **https://vercel.com/dashboard**
2. Faça login
3. Procure pelo projeto: **amzofertas** ou **hello-buddy-launchpad**
4. Clique no projeto

### 2. Ver as Variáveis de Ambiente

1. No menu superior, clique em **"Settings"**
2. No menu lateral esquerdo, clique em **"Environment Variables"**
3. Você verá uma lista de variáveis

### 3. Encontrar a URL do Supabase

Procure por estas variáveis:
- `VITE_SUPABASE_URL` 
- Ou `SUPABASE_URL`

**O valor será algo como:**
```
https://XXXXX.supabase.co
```

**O `XXXXX` é o ID do projeto!**

---

## ✅ Depois de Encontrar

**Me envie:**
- ✅ O ID do projeto (os caracteres antes de `.supabase.co`)
- ✅ Ou tire um print da tela mostrando a variável `VITE_SUPABASE_URL`

Com isso, eu te ajudo a:
1. Acessar o projeto correto no Supabase Dashboard
2. Fazer o deploy da edge function

---

## 🚀 Exemplo

Se você ver:
```
VITE_SUPABASE_URL = https://abc123xyz.supabase.co
```

O ID do projeto é: **`abc123xyz`**

---

**É muito mais fácil assim!** Me envie o que você encontrar! 😊
