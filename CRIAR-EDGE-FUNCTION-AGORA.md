# 🚀 Criar Edge Function Agora

## ✅ Secrets Configurados!

Agora vamos criar a edge function.

---

## 📋 Passo a Passo

### 1. Ir para Edge Functions

1. No menu lateral esquerdo, clique em **"Edge Functions"** (ou "Funções de Borda")
2. Você verá uma lista de funções (provavelmente vazia)

### 2. Criar Nova Função

1. Clique em **"Create Function"** ou **"New Function"** ou **"Nova Função"**
2. **Nome da função:** `criar-instancia-wuzapi-afiliado`
   - ⚠️ **IMPORTANTE:** O nome deve ser exatamente assim (sem espaços, com hífens)
3. Clique em **"Create"** ou **"Criar"**

### 3. Colar o Código

1. Você verá um editor de código
2. **Apague todo o código** que está lá: `Ctrl + A` → `Delete`
3. Abra este arquivo no seu computador:
   ```
   C:\Users\usuario\hello-buddy-launchpad\supabase\functions\criar-instancia-wuzapi-afiliado\index.ts
   ```
4. **Copie todo o código:** `Ctrl + A` → `Ctrl + C`
5. **Cole no editor do Supabase:** `Ctrl + V`
6. Verifique se o código foi colado completamente

### 4. Fazer Deploy

1. Clique em **"Deploy"** ou **"Salvar"** ou **"Save"**
2. Aguarde alguns segundos (10-30 segundos)
3. Você verá uma mensagem de sucesso ✅

---

## ✅ Verificar se Funcionou

1. Na página da função, veja se aparece **"Active"** ou **"Deployed"** ou **"Ativo"**
2. Clique em **"Logs"** para ver se há erros
3. Se não houver erros, está tudo certo! ✅

---

## 🆘 Se Der Erro

**Erro: "Function already exists"**
- Tudo certo! Só precisa atualizar o código (cole o código novo e faça deploy)

**Erro: "Invalid code"**
- Verifique se copiou o código completo
- Não esqueça as primeiras linhas: `import { serve }...`

**Erro: "Secret not found"**
- Verifique se os secrets foram salvos corretamente
- Os nomes devem ser: `PROJECT_URL` e `SERVICE_ROLE_KEY` (em inglês)

---

## 🚀 Próximo Passo

Depois do deploy, vamos testar no site!

---

**Vamos lá!** Me avise quando terminar! 😊
