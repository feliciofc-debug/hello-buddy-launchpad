# ☕ Resumo Rápido - O Que Fazer no Vercel

## 🎯 Informações do Novo Projeto

**URL:** `https://zunuqaidxffuhwmvcwul.supabase.co`  
**Chave:** `sb_publishable_BT7lsfrAYrPII7bsH_I6WA_zmDkhorc`

---

## 📋 Passo a Passo no Vercel

### 1. Acessar o Vercel

1. Vá para: **https://vercel.com/dashboard**
2. Faça login
3. Clique no projeto: **amzofertas** (ou o nome do seu projeto)

### 2. Atualizar Variáveis de Ambiente

1. No menu superior, clique em **"Settings"**
2. No menu lateral esquerdo, clique em **"Environment Variables"**
3. Você verá as variáveis existentes

### 3. Editar `VITE_SUPABASE_URL`

1. Encontre a variável: **`VITE_SUPABASE_URL`**
2. Clique no **ícone de editar** (lápis) ou clique na variável
3. **Apague** o valor antigo: `https://jibpvpqgplmahjhswiza.supabase.co`
4. **Cole** o valor novo: `https://zunuqaidxffuhwmvcwul.supabase.co`
5. Clique em **"Save"**

### 4. Editar `VITE_SUPABASE_ANON_KEY`

1. Encontre a variável: **`VITE_SUPABASE_ANON_KEY`**
2. Clique no **ícone de editar** (lápis) ou clique na variável
3. **Apague** o valor antigo
4. **Cole** o valor novo: `sb_publishable_BT7lsfrAYrPII7bsH_I6WA_zmDkhorc`
5. Clique em **"Save"**

### 5. Fazer Redeploy (IMPORTANTE!)

Depois de atualizar as variáveis:

1. Vá em **"Deployments"** (no menu superior)
2. Encontre o **último deploy** na lista
3. Clique nos **3 pontinhos** (⋯) ao lado do deploy
4. Clique em **"Redeploy"**
5. Aguarde o deploy terminar (2-5 minutos)

---

## ✅ Verificar se Funcionou

1. Aguarde o deploy terminar
2. Acesse: **https://amzofertas.com.br**
3. Pressione **F12** (console)
4. Procure por: `✅ [SUPABASE] Configurado: https://zunuqaidxffuhwmvcwul.supabase.co`
5. Se aparecer essa mensagem, está funcionando! ✅

---

## 🆘 Se Der Erro

**Erro: "Variable not found"**
- Verifique se o nome da variável está exatamente: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

**Erro: "Invalid URL"**
- Verifique se copiou a URL completa: `https://zunuqaidxffuhwmvcwul.supabase.co`

**Site ainda não funciona:**
- Aguarde mais alguns minutos após o redeploy
- Limpe o cache do navegador (`Ctrl + Shift + Delete`)

---

## 📝 Checklist

- [ ] Atualizar `VITE_SUPABASE_URL` no Vercel
- [ ] Atualizar `VITE_SUPABASE_ANON_KEY` no Vercel
- [ ] Fazer redeploy
- [ ] Aguardar deploy terminar
- [ ] Testar no site

---

**Depois que terminar, me avise!** Vamos para os próximos passos! 🚀
