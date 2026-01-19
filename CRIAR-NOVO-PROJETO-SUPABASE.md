# 🚀 Criar Novo Projeto Supabase e Atualizar Vercel

## 🎯 Situação

Você não tem mais acesso ao projeto antigo (`jibpvpqgplmahjhswiza`), então vamos criar um novo projeto e atualizar tudo!

---

## 📋 Passo a Passo

### 1️⃣ Criar Novo Projeto no Supabase

1. Vá para: **https://supabase.com/dashboard**
2. Certifique-se de estar logado com: **feliciofc@gmail.com**
3. Clique em **"New Project"** ou **"Create Project"**
4. Preencha:
   - **Name:** `amzofertas` (ou o nome que preferir)
   - **Database Password:** Crie uma senha forte (anote ela!)
   - **Region:** Escolha a mais próxima (ex: `South America (São Paulo)`)
   - **Pricing Plan:** Selecione o plano que você contratou
5. Clique em **"Create new project"**
6. Aguarde 2-3 minutos enquanto o projeto é criado

### 2️⃣ Anotar as Credenciais do Novo Projeto

Depois que o projeto for criado:

1. Vá em **Settings** → **API**
2. Você verá:
   - **Project URL:** `https://XXXXX.supabase.co` (anote o `XXXXX`)
   - **anon public key:** `eyJ...` (copie essa chave)
   - **service_role key:** `eyJ...` (copie essa chave também)

**IMPORTANTE:** Anote essas informações! Você vai precisar delas.

### 3️⃣ Atualizar Variáveis no Vercel

1. Vá para: **https://vercel.com/dashboard**
2. Clique no seu projeto (amzofertas)
3. Vá em **Settings** → **Environment Variables**
4. **Edite** a variável `VITE_SUPABASE_URL`:
   - Valor antigo: `https://jibpvpqgplmahjhswiza.supabase.co`
   - Valor novo: `https://XXXXX.supabase.co` (use o ID do novo projeto)
5. **Edite** a variável `VITE_SUPABASE_ANON_KEY`:
   - Valor novo: Cole a **anon public key** do novo projeto
6. Clique em **"Save"** em cada uma

### 4️⃣ Configurar Secrets no Supabase (Para Edge Functions)

1. No Supabase Dashboard do novo projeto, vá em **Settings** → **Edge Functions** → **Secrets**
2. Adicione os seguintes secrets:
   - **SUPABASE_URL:** `https://XXXXX.supabase.co` (URL do novo projeto)
   - **SUPABASE_SERVICE_ROLE_KEY:** Cole a **service_role key** que você copiou
   - **CONTABO_WUZAPI_ADMIN_TOKEN:** (se você tiver, adicione também)

### 5️⃣ Fazer Deploy da Edge Function

1. No Supabase Dashboard, vá em **Edge Functions**
2. Clique em **"Create Function"** ou **"New Function"**
3. Nome: `criar-instancia-wuzapi-afiliado`
4. Clique em **"Create"**
5. Abra este arquivo no seu computador:
   ```
   C:\Users\usuario\hello-buddy-launchpad\supabase\functions\criar-instancia-wuzapi-afiliado\index.ts
   ```
6. Copie todo o código: `Ctrl + A` → `Ctrl + C`
7. Cole no editor do Supabase: `Ctrl + V`
8. Clique em **"Deploy"**
9. Aguarde alguns segundos

### 6️⃣ Atualizar o Código Local (Opcional)

Se quiser atualizar o código local também:

1. Abra: `C:\Users\usuario\hello-buddy-launchpad\src\integrations\supabase\client.ts`
2. Atualize a URL e a chave para o novo projeto
3. Faça commit e push (o Vercel vai fazer deploy automaticamente)

---

## ✅ Verificar se Funcionou

1. Aguarde 2-3 minutos para o Vercel fazer deploy
2. Acesse: https://amzofertas.com.br
3. Teste a funcionalidade de conectar WhatsApp
4. Veja se não há erros no console (F12)

---

## 🆘 Se Der Erro

**Erro: "Project not found"**
- Verifique se atualizou as variáveis no Vercel corretamente

**Erro: "Unauthorized"**
- Verifique se copiou a chave correta (anon key, não service_role)

**Erro na Edge Function**
- Verifique se configurou os secrets no Supabase

---

## 📝 Resumo

1. ✅ Criar novo projeto Supabase
2. ✅ Anotar credenciais (URL, anon key, service_role key)
3. ✅ Atualizar variáveis no Vercel
4. ✅ Configurar secrets no Supabase
5. ✅ Fazer deploy da edge function
6. ✅ Testar no site

---

**Vamos começar!** Me avise quando criar o novo projeto e eu te ajudo com os próximos passos! 🚀
