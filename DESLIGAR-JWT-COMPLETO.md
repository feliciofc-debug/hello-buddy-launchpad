# 🔥 Desligar JWT de Todo o Projeto

## ✅ O Que Foi Verificado

1. **config.toml:** A função `criar-instancia-wuzapi-afiliado` já está com `verify_jwt = false` ✅
2. **Código da função:** A função faz autenticação própria (não depende de JWT automático) ✅

---

## ⚠️ PROBLEMA PRINCIPAL

O **JWT Legacy no Dashboard do Supabase** está ativado! Isso é uma configuração no Dashboard, não no código.

---

## ✅ SOLUÇÃO: Desativar no Dashboard

### Passo Único e Crítico:

1. No Supabase Dashboard, vá na função `criar-instancia-wuzapi-afiliado`
2. Clique na aba **"Detalhes"**
3. Procure por **"Verificar JWT com segredo legado"**
4. **DESATIVE** (mude de verde para cinza)
5. Clique em **"Salvar alterações"**

**Isso vai resolver o erro 401!**

---

## 📋 Status Atual

- ✅ Código: JWT desativado no config.toml
- ✅ Código: Função faz autenticação própria
- ⚠️ **Dashboard: JWT Legacy precisa ser desativado manualmente**

---

## 🚀 Depois de Desativar

1. Limpe o cache do navegador (`Ctrl + Shift + Delete`)
2. OU teste em janela anônima (`Ctrl + Shift + N`)
3. Teste criar a instância novamente

---

**O JWT Legacy no Dashboard é o problema!** Desative lá e o erro 401 vai sumir! 🚀
