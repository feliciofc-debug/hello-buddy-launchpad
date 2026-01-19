# ⚠️ URGENTE: Corrigir Variável no Vercel

## 🔴 Problema

O erro 500 está acontecendo porque o **Vercel ainda está usando a URL antiga** do Supabase!

O console mostra: `gbtqircfseqcfmcqlngr` (projeto antigo)

**Precisa ser:** `zunuqaidxffuhwmvcwul` (projeto novo)

---

## ✅ Solução: Atualizar Variável no Vercel

### 1. Acessar Vercel Dashboard

1. Vá para: https://vercel.com/dashboard
2. Encontre seu projeto `amzofertas` (ou nome do projeto)
3. Clique nele

### 2. Ir em Settings → Environment Variables

1. No menu do projeto, clique em **"Settings"**
2. No menu lateral, clique em **"Environment Variables"**

### 3. Encontrar e Editar `VITE_SUPABASE_URL`

1. Procure pela variável: **`VITE_SUPABASE_URL`**
2. Clique nos **3 pontinhos** (⋯) ao lado dela
3. Clique em **"Edit"** ou **"Edit Value"**

### 4. Atualizar o Valor

**Valor ANTIGO (remover):**
```
https://gbtqircfseqcfmcqlngr.supabase.co
```
ou
```
https://qbtqjrcfseqcfmcqlngr.supabase.co
```
ou
```
https://jibpvpqgplmahjhswiza.supabase.co
```

**Valor NOVO (colar):**
```
https://zunuqaidxffuhwmvcwul.supabase.co
```

### 5. Salvar

1. Clique em **"Save"** ou **"Update"**
2. Aguarde a confirmação

### 6. Fazer Novo Deploy

**IMPORTANTE:** Após mudar a variável, você precisa fazer um novo deploy!

1. Vá em **"Deployments"** (no menu do projeto)
2. Clique nos **3 pontinhos** (⋯) do último deploy
3. Clique em **"Redeploy"**
4. Ou faça um commit/push qualquer para forçar novo deploy

---

## 🔍 Verificar se Funcionou

Depois do novo deploy:

1. Acesse seu site: `amzofertas.com.br`
2. Abra o Console do navegador (F12)
3. Procure por: `✅ [SUPABASE] Configurado: https://zunuqaidxffuhwmvcwul.supabase.co`
4. Se aparecer essa mensagem, está correto!

---

## ⚠️ Se Não Encontrar a Variável

Se a variável `VITE_SUPABASE_URL` **não existir**:

1. Clique em **"Add New"** ou **"Add Variable"**
2. **Name:** `VITE_SUPABASE_URL`
3. **Value:** `https://zunuqaidxffuhwmvcwul.supabase.co`
4. Selecione os ambientes: **Production**, **Preview**, **Development**
5. Clique em **"Save"**

---

## 📋 Checklist

- [ ] Acessei o Vercel Dashboard
- [ ] Fui em Settings → Environment Variables
- [ ] Encontrei `VITE_SUPABASE_URL`
- [ ] Atualizei para: `https://zunuqaidxffuhwmvcwul.supabase.co`
- [ ] Salvei a alteração
- [ ] Fiz um novo deploy (Redeploy)
- [ ] Verifiquei no console do navegador se está correto

---

**Faça isso AGORA e me avise quando terminar!** 🚀
