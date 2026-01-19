# 🚀 Deploy da Edge Function - GUIA SUPER SIMPLES

## ⚠️ IMPORTANTE: Primeiro Encontre o Projeto Correto!

Antes de fazer o deploy, você precisa encontrar qual é o projeto Supabase correto.

---

## 🔍 Passo 1: Descobrir o Projeto Correto

### Opção A: Pelo Site (Mais Fácil)

1. Abra: **https://amzofertas.com.br**
2. Pressione **F12** (abre o console)
3. Vá na aba **"Console"**
4. Procure por: `✅ [SUPABASE] Configurado: https://XXXXX.supabase.co`
5. **Anote o ID** (os caracteres antes de `.supabase.co`)

### Opção B: Pelo Dashboard do Supabase

1. Vá para: **https://supabase.com/dashboard**
2. Faça login
3. Clique no seu **avatar** (canto superior direito)
4. Vá em **"All Projects"**
5. Procure por projetos relacionados a **"amzofertas"** ou **"hello-buddy"**
6. Clique no projeto que estiver **ativo** (não em "provisioning")

---

## 🚀 Passo 2: Fazer Deploy da Edge Function

### 1. Acessar o Projeto Correto

1. No Supabase Dashboard, certifique-se de estar no projeto correto
2. A URL deve mostrar o ID do projeto: `https://supabase.com/dashboard/project/XXXXX`

### 2. Ir em Edge Functions

1. No menu lateral esquerdo, clique em **"Edge Functions"**
2. Você verá uma lista de funções

### 3. Encontrar ou Criar a Função

**Se a função já existir:**
- Procure por: **`criar-instancia-wuzapi-afiliado`**
- Clique nela
- Clique em **"Edit"** ou **"Deploy"**

**Se a função NÃO existir:**
- Clique em **"Create Function"** ou **"New Function"**
- Nome: `criar-instancia-wuzapi-afiliado`
- Clique em **"Create"**

### 4. Copiar o Código

1. Abra este arquivo no seu computador:
   ```
   C:\Users\usuario\hello-buddy-launchpad\supabase\functions\criar-instancia-wuzapi-afiliado\index.ts
   ```
2. **Selecione tudo:** `Ctrl + A`
3. **Copie:** `Ctrl + C`

### 5. Colar no Supabase

1. Volte para o navegador (editor do Supabase)
2. **Apague todo o código** que está lá: `Ctrl + A` → `Delete`
3. **Cole o código novo:** `Ctrl + V`

### 6. Fazer Deploy

1. Clique em **"Deploy"** ou **"Save"**
2. Aguarde 10-30 segundos
3. Você verá uma mensagem de sucesso ✅

---

## ✅ Verificar se Funcionou

1. Na página da função, veja se aparece **"Active"** ou **"Deployed"**
2. Clique em **"Logs"** para ver se há erros
3. Teste no site: https://amzofertas.com.br/afiliado/conectar-celular

---

## 🆘 Se Der Erro

**Erro: "Function not found"**
- A função não existe ainda, crie ela primeiro (Passo 3)

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

## 💡 Dica

**Se você não encontrar o projeto:**
- Me envie o ID do projeto que você encontrou no console (F12)
- Ou me diga quais projetos aparecem na lista do Supabase Dashboard
- Eu te ajudo a identificar qual é o correto!

---

**Pronto!** Depois do deploy, teste no site! 🎉
