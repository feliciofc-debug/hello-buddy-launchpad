# 🔥 Correção do Erro 401 - AÇÃO IMEDIATA

## ⚠️ Problemas Identificados

1. ❌ **Erro 401** - Função retornando não autorizado
2. ❌ **URL antiga** ainda aparecendo (`gbtqjrcfseqcfmcqlngr`)

---

## ✅ SOLUÇÃO EM 2 PASSOS CRÍTICOS

### 1️⃣ DESATIVAR JWT LEGACY (MAIS IMPORTANTE!)

**Isso é a causa principal do 401!**

1. No Supabase Dashboard, vá na função `criar-instancia-wuzapi-afiliado`
2. Clique na aba **"Detalhes"**
3. Procure por **"Verificar JWT com segredo legado"**
4. **DESATIVE o toggle** (mude de verde para cinza)
5. Clique em **"Salvar alterações"**

**Por quê?** O código já faz autenticação própria. O JWT legacy está bloqueando as requisições!

---

### 2️⃣ LIMPAR CACHE E TESTAR

1. **Limpar cache:**
   - Pressione `Ctrl + Shift + Delete`
   - Selecione: "Imagens e arquivos em cache" + "Cookies"
   - Período: "Todo o período"
   - Clique em "Limpar dados"

2. **OU testar em janela anônima:**
   - Pressione `Ctrl + Shift + N`
   - Acesse: https://amzofertas.com.br/afiliado/conectar-celular
   - Faça login
   - Tente criar a instância

---

## 🔍 Verificar Logs da Função

Se ainda der erro após desativar o JWT:

1. No Supabase Dashboard → função `criar-instancia-wuzapi-afiliado`
2. Clique na aba **"Registros"** (Logs)
3. Veja qual erro aparece
4. Me envie o erro completo

---

## 📋 Checklist

- [ ] **JWT legacy DESATIVADO** (aba "Detalhes" da função)
- [ ] Cache limpo OU testado em janela anônima
- [ ] Testar criar instância novamente
- [ ] Verificar logs se ainda der erro

---

## 💡 Por Que o 401 Acontece?

O JWT legacy está verificando o token ANTES do código da função rodar. Como o código já faz autenticação própria, isso causa conflito e retorna 401.

**Solução:** Desativar o JWT legacy para o código fazer a autenticação.

---

**O passo 1 (desativar JWT legacy) é CRÍTICO!** Faça isso primeiro! 🚀
