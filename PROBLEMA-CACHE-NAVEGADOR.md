# 🔍 Problema: Cache do Navegador

## ✅ Variável no Vercel está Correta!

Você confirmou que:
- `VITE_SUPABASE_URL` = `https://zunuqaidxffuhwmvcwul.supabase.co` ✅
- Foi atualizada há 6 horas ✅

---

## ⚠️ Mas o Problema Persiste?

Se a variável está correta mas o site ainda mostra URLs antigas, pode ser:

### 1. **Cache do Navegador** (mais provável)
O navegador está usando código antigo em cache.

### 2. **Service Worker** (se houver)
Service Workers podem manter código antigo.

### 3. **Deploy não foi feito após atualizar**
A variável foi atualizada, mas o site não foi redesployado.

---

## ✅ Soluções

### Solução 1: Limpar Cache do Navegador

1. No Chrome, pressione **Ctrl + Shift + Delete**
2. Selecione:
   - ✅ **Imagens e arquivos em cache**
   - ✅ **Cookies e outros dados do site**
3. Período: **Última hora** ou **Todo o período**
4. Clique em **"Limpar dados"**

### Solução 2: Hard Refresh

1. Acesse: `https://amzofertas.com.br`
2. Pressione **Ctrl + Shift + R** (ou **Ctrl + F5**)
3. Isso força o navegador a baixar tudo novamente

### Solução 3: Modo Anônimo

1. Abra uma **janela anônima** (Ctrl + Shift + N)
2. Acesse: `https://amzofertas.com.br`
3. Veja se funciona (sem cache)

### Solução 4: Verificar se Fez Redeploy

1. No Vercel Dashboard, vá em **"Deployments"**
2. Veja a **data/hora do último deploy**
3. Se foi **ANTES** de atualizar a variável (6h atrás), precisa fazer **Redeploy**:
   - Clique nos 3 pontinhos do último deploy
   - Clique em **"Redeploy"**

---

## 🔍 Verificar Service Worker

1. No Chrome, pressione **F12**
2. Vá na aba **"Application"**
3. No menu lateral, clique em **"Service Workers"**
4. Se aparecer algum service worker:
   - Clique em **"Unregister"** (desregistrar)
   - Recarregue a página

---

## 📋 Checklist

- [ ] Limpei o cache do navegador (Ctrl + Shift + Delete)
- [ ] Fiz Hard Refresh (Ctrl + Shift + R)
- [ ] Testei em modo anônimo
- [ ] Verifiquei se fiz Redeploy após atualizar variável
- [ ] Desregistrei Service Workers (se houver)

---

## 🎯 Teste Final

Depois de limpar cache e fazer hard refresh:

1. Acesse: `https://amzofertas.com.br`
2. Abra o Console (F12)
3. Procure por:
   ```
   ✅ [SUPABASE] Configurado: https://zunuqaidxffuhwmvcwul.supabase.co
   ```
4. Se aparecer, está funcionando! ✅

---

**Tente essas soluções e me avise o resultado!** 🚀
