# 🔥 Solução Final para o Erro 401

## ⚠️ Problema Identificado

Vejo no console:
- ❌ Erro 401 (Unauthorized)
- ❌ URL antiga ainda aparecendo: `gbtqjrcfseqcfmcqlngr`

---

## ✅ SOLUÇÃO EM 3 PASSOS

### 1️⃣ Desativar JWT Legacy (CRÍTICO!)

1. No Supabase Dashboard, vá na função `criar-instancia-wuzapi-afiliado`
2. Clique na aba **"Detalhes"**
3. Procure por **"Verificar JWT com segredo legado"**
4. **DESATIVE** (mude de verde para cinza)
5. Clique em **"Salvar alterações"**

**Isso é a causa principal do erro 401!**

---

### 2️⃣ Limpar Cache do Navegador

1. Pressione `Ctrl + Shift + Delete`
2. Selecione:
   - ✅ Imagens e arquivos em cache
   - ✅ Cookies e outros dados do site
3. Período: **"Todo o período"**
4. Clique em **"Limpar dados"**
5. Feche e abra o navegador novamente

---

### 3️⃣ Testar em Janela Anônima

1. Pressione `Ctrl + Shift + N` (abre janela anônima)
2. Acesse: https://amzofertas.com.br/afiliado/conectar-celular
3. Faça login
4. Tente criar a instância

---

## 🔍 Verificar Logs da Função

Se ainda der erro:

1. No Supabase Dashboard → função `criar-instancia-wuzapi-afiliado`
2. Clique na aba **"Registros"** (Logs)
3. Veja qual erro aparece
4. Me envie o erro

---

## 📋 Checklist Rápido

- [ ] JWT legacy DESATIVADO (aba "Detalhes")
- [ ] Cache do navegador limpo
- [ ] Testar em janela anônima
- [ ] Verificar logs se ainda der erro

---

**O passo mais importante é DESATIVAR o JWT legacy!** Isso deve resolver o 401. 🚀
