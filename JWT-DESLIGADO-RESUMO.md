# ✅ JWT Desligado - Resumo

## 🔍 O Que Foi Feito

### 1. Arquivo config.toml
- ✅ `criar-instancia-wuzapi-afiliado`: `verify_jwt = false` (já estava)
- ✅ `wuzapi-qrcode`: Alterado de `true` para `false`
- ✅ Todas as outras funções: `verify_jwt = false`

### 2. Código da Função
- ✅ A função `criar-instancia-wuzapi-afiliado` faz autenticação própria
- ✅ Não depende de JWT automático do Supabase

---

## ⚠️ AÇÃO NECESSÁRIA NO DASHBOARD

**O JWT Legacy no Dashboard do Supabase ainda está ativado!**

Isso é uma configuração separada do código. Você precisa desativar manualmente:

1. No Supabase Dashboard → função `criar-instancia-wuzapi-afiliado`
2. Aba **"Detalhes"**
3. **"Verificar JWT com segredo legado"** → DESATIVAR (cinza)
4. **"Salvar alterações"**

---

## 🚀 Depois de Desativar no Dashboard

1. Limpe o cache do navegador
2. Teste criar a instância novamente
3. O erro 401 deve desaparecer!

---

**O código está correto. Falta só desativar no Dashboard!** 🚀
