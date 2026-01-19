# 🚨 URGENTE: VERCEL PRECISA SER ATUALIZADO AGORA!

## 🔴 PROBLEMA CRÍTICO

O site em produção (Vercel) **AINDA ESTÁ USANDO A URL ANTIGA** do Supabase!

Por isso você vê no console:
- `gbtqircfseqcfmcqlngr.supabase.co` ❌
- `qbtqjrcfseqcfmcqlngr.supabase.co` ❌

**Precisa ser:**
- `zunuqaidxffuhwmvcwul.supabase.co` ✅

---

## ✅ SOLUÇÃO: ATUALIZAR VERCEL AGORA

### Passo 1: Acessar Vercel

1. Vá para: **https://vercel.com/dashboard**
2. Faça login
3. Encontre seu projeto `amzofertas` (ou nome do seu projeto)
4. **CLIQUE NELE**

### Passo 2: Ir em Settings → Environment Variables

1. No menu do projeto, clique em **"Settings"** (Configurações)
2. No menu lateral esquerdo, clique em **"Environment Variables"** (Variáveis de Ambiente)

### Passo 3: Encontrar e ATUALIZAR `VITE_SUPABASE_URL`

1. Procure pela variável: **`VITE_SUPABASE_URL`**
2. Você verá algo como:
   ```
   VITE_SUPABASE_URL = https://gbtqircfseqcfmcqlngr.supabase.co
   ```
   ou
   ```
   VITE_SUPABASE_URL = https://jibpvpqgplmahjhswiza.supabase.co
   ```

3. Clique nos **3 pontinhos** (⋯) ao lado da variável
4. Clique em **"Edit"** ou **"Edit Value"**

### Passo 4: SUBSTITUIR o Valor

**APAGUE TUDO** que está no campo "Value" e **COLE**:
```
https://zunuqaidxffuhwmvcwul.supabase.co
```

### Passo 5: Verificar Ambientes

Certifique-se de que está marcado:
- ✅ **Production**
- ✅ **Preview**  
- ✅ **Development**

### Passo 6: SALVAR

1. Clique em **"Save"** ou **"Update"**
2. Aguarde a confirmação

### Passo 7: FAZER NOVO DEPLOY (OBRIGATÓRIO!)

**⚠️ IMPORTANTE:** Mudar a variável NÃO atualiza o site automaticamente!

1. Vá em **"Deployments"** (no menu do projeto)
2. Encontre o **último deploy**
3. Clique nos **3 pontinhos** (⋯) ao lado dele
4. Clique em **"Redeploy"**
5. Aguarde o deploy terminar (pode levar 1-2 minutos)

---

## 🔍 Verificar se Funcionou

Depois do novo deploy:

1. Acesse: **https://amzofertas.com.br**
2. Abra o Console do navegador (F12)
3. Procure por:
   ```
   ✅ [SUPABASE] Configurado: https://zunuqaidxffuhwmvcwul.supabase.co
   ```
4. Se aparecer essa mensagem, está correto! ✅

---

## ⚠️ Se Não Encontrar a Variável

Se a variável `VITE_SUPABASE_URL` **NÃO EXISTIR**:

1. Clique em **"Add New"** ou **"Add Variable"**
2. **Name:** `VITE_SUPABASE_URL`
3. **Value:** `https://zunuqaidxffuhwmvcwul.supabase.co`
4. Marque: **Production**, **Preview**, **Development**
5. Clique em **"Save"**
6. Faça um **Redeploy**

---

## 📋 Checklist Rápido

- [ ] Acessei o Vercel Dashboard
- [ ] Fui em Settings → Environment Variables
- [ ] Encontrei `VITE_SUPABASE_URL`
- [ ] Atualizei para: `https://zunuqaidxffuhwmvcwul.supabase.co`
- [ ] Salvei
- [ ] Fiz um **Redeploy** (OBRIGATÓRIO!)
- [ ] Verifiquei no console do navegador

---

## 🎯 Por Que Isso Resolve?

O código tem interceptors que corrigem URLs antigas, mas se o **Vercel está usando a variável de ambiente antiga**, o site em produção vai usar a URL errada desde o início.

**Atualizando a variável no Vercel + Redeploy = Problema resolvido!** ✅

---

**FAÇA ISSO AGORA! É A ÚNICA COISA QUE FALTA!** 🚀
