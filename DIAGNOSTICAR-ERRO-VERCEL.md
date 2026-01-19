# 🔍 Diagnosticar Erro no Site (Vercel)

## ⚠️ Problema

Quando você dá **F5** (recarrega a página), o site dá erro.

---

## 🎯 Passo 1: Ver Qual Erro Está Acontecendo

### 1. Abrir o Console do Navegador

1. Abra o site: **https://amzofertas.com.br**
2. Pressione **F12** (abre o console)
3. Vá na aba **"Console"**

### 2. Recarregar a Página

1. Pressione **F5** (recarrega a página)
2. **Observe o console** - aparecerão mensagens de erro em **vermelho**

### 3. Copiar o Erro

**Me envie:**
- ✅ A mensagem de erro completa (em vermelho)
- ✅ Ou tire um print da tela do console

---

## 🔍 Passo 2: Verificar o Status do Deploy no Vercel

### 1. Acessar o Vercel Dashboard

1. Vá para: **https://vercel.com/dashboard**
2. Faça login
3. Procure pelo projeto: **amzofertas** ou **hello-buddy-launchpad**

### 2. Verificar o Último Deploy

1. Clique no projeto
2. Veja o **último deploy** na lista
3. Verifique se está:
   - ✅ **Ready** (verde) = funcionando
   - ⚠️ **Building** (amarelo) = ainda compilando
   - ❌ **Error** (vermelho) = erro no build

### 3. Ver os Logs do Deploy

1. Clique no deploy (se tiver erro, será vermelho)
2. Vá em **"Logs"** ou **"Build Logs"**
3. Veja se há erros de compilação

---

## 🆘 Erros Comuns e Soluções

### Erro 1: "404 Not Found" ao recarregar

**Causa:** Problema de roteamento no Vercel

**Solução:** O `vercel.json` já está configurado corretamente. Pode ser cache.

**Como resolver:**
1. Vá no Vercel Dashboard
2. Clique no projeto
3. Vá em **Settings** → **General**
4. Verifique se **"Framework Preset"** está como **"Vite"**
5. Faça um novo deploy

### Erro 2: "Failed to fetch" ou erro de rede

**Causa:** Problema com variáveis de ambiente ou Supabase

**Solução:**
1. Vá no Vercel Dashboard
2. Clique no projeto
3. Vá em **Settings** → **Environment Variables**
4. Verifique se estão configuradas:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Erro 3: Erro de build no Vercel

**Causa:** Erro de compilação do código

**Solução:**
1. Veja os logs do deploy no Vercel
2. Me envie o erro completo
3. Vou corrigir o código

---

## 📋 O Que Me Enviar

Para eu te ajudar melhor, me envie:

1. ✅ **A mensagem de erro** do console (F12 → Console)
2. ✅ **O status do deploy** no Vercel (Ready/Error/Building)
3. ✅ **Os logs do deploy** (se houver erro)

---

## 🚀 Solução Rápida: Fazer Novo Deploy

Se o problema persistir, podemos forçar um novo deploy:

1. Vá no Vercel Dashboard
2. Clique no projeto
3. Vá em **Deployments**
4. Clique nos **3 pontinhos** do último deploy
5. Clique em **"Redeploy"**

---

**Me envie o erro que aparece no console quando você dá F5!** 😊
