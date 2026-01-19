# 🧹 Limpar Cache de Forma AGRESSIVA

## 🔴 Se Ainda Está Usando URL Antiga

Mesmo após atualizar o Vercel, o navegador pode estar usando código antigo em cache.

---

## ✅ Solução AGRESSIVA

### 1. Fechar TODAS as Abas do Site

1. Feche **TODAS** as abas que estão abertas com `amzofertas.com.br`
2. Feche **TODAS** as janelas do navegador

### 2. Limpar Cache COMPLETO

1. Pressione **Ctrl + Shift + Delete**
2. Marque **TUDO**:
   - ✅ Imagens e arquivos em cache
   - ✅ Cookies e outros dados do site
   - ✅ Histórico de navegação
   - ✅ Dados de sites hospedados
3. Período: **"Todo o período"**
4. Clique em **"Limpar dados"**

### 3. Limpar Service Workers

1. Pressione **F12** (abrir DevTools)
2. Vá na aba **"Application"** (ou "Aplicativo")
3. No menu lateral, clique em **"Service Workers"**
4. Se aparecer algum service worker:
   - Clique em **"Unregister"** (desregistrar)
   - Clique em **"Clear storage"** (limpar armazenamento)

### 4. Limpar LocalStorage e SessionStorage

1. Na mesma aba **"Application"**
2. Clique em **"Local Storage"**
3. Clique no domínio `amzofertas.com.br`
4. Clique com botão direito → **"Clear"**
5. Faça o mesmo para **"Session Storage"**

### 5. Fechar e Reabrir o Navegador

1. Feche o navegador **completamente** (todas as janelas)
2. Aguarde 10 segundos
3. Abra o navegador novamente

### 6. Testar em Modo Anônimo

1. Abra uma **janela anônima** (Ctrl + Shift + N)
2. Acesse: `https://amzofertas.com.br`
3. Veja se funciona (sem cache)

---

## 🔍 Verificar no Console

Depois de limpar tudo:

1. Abra o Console (F12)
2. Procure por:
   - ✅ `✅ [SUPABASE] Configurado: https://zunuqaidxffuhwmvcwul.supabase.co`
   - ✅ `✅ [FUNCTIONS.INVOKE] Usando backupClient com URL correta`
   - ❌ **NÃO** deve aparecer: `qbtqjrcfseqcfmcqlngr` ou `gbtqjrcfseqcfmcqlngr`

---

## ⚠️ Se AINDA Não Funcionar

Pode ser que o deploy do Vercel ainda não tenha terminado. Verifique:

1. Vercel Dashboard → Deployments
2. Veja se o último deploy está **"Ready"** (verde)
3. Se estiver "Building" ou "Error", aguarde ou verifique o erro

---

**Tente limpar o cache de forma agressiva e me avise!** 🚀
