# 🚀 Como Fazer Deploy da Edge Function - GUIA SIMPLES

## 📋 O Que Você Precisa Fazer

Fazer o deploy da edge function é como "enviar" o código para o Supabase funcionar.

---

## 🎯 MÉTODO MAIS FÁCIL: Via Dashboard do Supabase

### Passo 1: Acessar o Supabase

1. Abra o navegador
2. Vá para: **https://supabase.com/dashboard**
3. Faça login na sua conta
4. Selecione o projeto: **jibpvpqgplmahjhswiza**

### Passo 2: Encontrar Edge Functions

1. No menu lateral esquerdo, procure por **"Edge Functions"**
2. Clique em **"Edge Functions"**
3. Você verá uma lista de funções

### Passo 3: Encontrar a Função

1. Procure por: **`criar-instancia-wuzapi-afiliado`**
2. Clique nela

### Passo 4: Editar o Código

1. Clique no botão **"Edit"** ou **"Deploy"** (depende da interface)
2. Você verá um editor de código
3. **APAGUE TODO o código** que está lá
4. **COLE** o código do arquivo: `C:\Users\usuario\hello-buddy-launchpad\supabase\functions\criar-instancia-wuzapi-afiliado\index.ts`

**Como copiar o código:**
- Abra o arquivo no Bloco de Notas ou VS Code
- Selecione tudo (`Ctrl + A`)
- Copie (`Ctrl + C`)
- Cole no editor do Supabase (`Ctrl + V`)

### Passo 5: Fazer Deploy

1. Clique no botão **"Deploy"** ou **"Save"**
2. Aguarde alguns segundos
3. Você verá uma mensagem de sucesso ✅

---

## ✅ Verificar se Funcionou

1. Na página da função, veja se aparece **"Active"** ou **"Deployed"**
2. Clique em **"Logs"** para ver se há erros
3. Teste no site: https://amzofertas.com.br/afiliado/conectar-celular

---

## 🔧 Se Não Encontrar a Função

Se a função não existir ainda:

1. Clique em **"Create Function"** ou **"New Function"**
2. Nome: `criar-instancia-wuzapi-afiliado`
3. Cole o código
4. Clique em **"Deploy"**

---

## 📝 Código para Copiar

O código está em:
```
C:\Users\usuario\hello-buddy-launchpad\supabase\functions\criar-instancia-wuzapi-afiliado\index.ts
```

**Dica:** Abra esse arquivo, copie tudo e cole no Supabase!

---

## 🆘 Se Der Erro

**Erro: "Function already exists"**
- Tudo certo! Só precisa atualizar o código

**Erro: "Invalid code"**
- Verifique se copiou o código completo
- Não esqueça as primeiras linhas: `import { serve }...`

**Erro: "Secrets not found"**
- Vá em **Settings** → **Edge Functions** → **Secrets**
- Verifique se estão configurados:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CONTABO_WUZAPI_ADMIN_TOKEN` (opcional)

---

## ⏱️ Quanto Tempo Demora?

- **Deploy:** 10-30 segundos
- **Ativação:** Imediata

---

**Pronto!** Depois do deploy, teste no site! 🎉
