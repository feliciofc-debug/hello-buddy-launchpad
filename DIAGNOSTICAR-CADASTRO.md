# 🔍 Diagnosticar Problema de Cadastro

## 📋 PASSO 1: Verificar Console do Navegador

1. Abra o site: `http://localhost:8080/`
2. Pressione **F12** (abrir DevTools)
3. Vá na aba **Console**
4. Tente fazer cadastro
5. **COPIE TODOS OS ERROS** que aparecerem (mensagens em vermelho)

---

## 📋 PASSO 2: Verificar Configuração do Supabase

1. Acesse: https://supabase.com/dashboard/project/zunuqaidxffuhwmvcwul
2. Vá em **Authentication** → **Settings**
3. Verifique:
   - **Enable email signup**: Deve estar ✅ **ATIVADO**
   - **Enable email confirmations**: Pode estar desativado para testes
   - **Site URL**: Deve ter `http://localhost:8080`
   - **Redirect URLs**: Deve ter `http://localhost:8080/**`

---

## 📋 PASSO 3: Verificar Tabela `profiles`

O cadastro tenta atualizar a tabela `profiles`. Verifique se ela existe:

1. Supabase Dashboard → **Table Editor**
2. Procure pela tabela `profiles`
3. Se **NÃO existir**, precisamos criá-la

---

## 📋 PASSO 4: Testar Cadastro Direto no Supabase

1. Supabase Dashboard → **Authentication** → **Users**
2. Clique em **"Add user"** → **"Create new user"**
3. Preencha:
   - Email: `teste@teste.com`
   - Password: `123456`
   - Auto Confirm User: ✅ (marcar)
4. Clique em **"Create user"**
5. Se funcionar aqui, o problema é no código do site

---

## 📋 PASSO 5: Verificar Erro Específico

Me envie:
1. **Mensagem de erro exata** do console (F12)
2. **Mensagem de erro** que aparece na tela (toast/alert)
3. **Screenshot** do console quando tenta cadastrar

---

## 🔧 SOLUÇÃO RÁPIDA: Criar Usuário Manualmente

Se o cadastro não funcionar, crie o usuário manualmente:

1. Supabase Dashboard → **Authentication** → **Users** → **"Add user"**
2. Preencha seus dados
3. Marque **"Auto Confirm User"**
4. Clique em **"Create user"**
5. Faça login no localhost com esse usuário

---

**Me envie o que aparece no console quando você tenta cadastrar!**
