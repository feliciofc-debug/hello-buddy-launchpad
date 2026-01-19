# ✅ Projeto Pronto! Agora Vamos Configurar

## 🎯 Status Atual

✅ Projeto Supabase: **Ready**  
✅ Vercel: **Deploy concluído**  
⏳ Falta: Configurar secrets e fazer deploy da edge function

---

## 📋 Próximos Passos

### 1️⃣ Pegar a Service Role Key

1. No Supabase Dashboard, clique em **"Settings"** (ícone de engrenagem no menu lateral)
2. Clique em **"API"**
3. Você verá duas chaves:
   - **anon public key:** `sb_publishable_...` (já temos essa)
   - **service_role key:** `sb_...` (precisamos dessa!)
4. **Copie a service_role key** (clique no botão "Copy" ou "Reveal" para ver)
5. **ANOTE essa chave** - você vai precisar dela!

### 2️⃣ Configurar Secrets no Supabase

1. No Supabase Dashboard, vá em **"Settings"** → **"Edge Functions"**
2. Clique em **"Secrets"** (ou procure por "Secrets" no menu)
3. Clique em **"Add Secret"** ou **"New Secret"**
4. Adicione os seguintes secrets (um de cada vez):

   **Secret 1:**
   - **Name:** `SUPABASE_URL`
   - **Value:** `https://zunuqaidxffuhwmvcwul.supabase.co`
   - Clique em **"Save"**

   **Secret 2:**
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** (cole a service_role key que você copiou)
   - Clique em **"Save"**

   **Secret 3 (Opcional):**
   - **Name:** `CONTABO_WUZAPI_ADMIN_TOKEN`
   - **Value:** (se você tiver esse token, adicione também)
   - Clique em **"Save"**

### 3️⃣ Fazer Deploy da Edge Function

1. No Supabase Dashboard, clique em **"Edge Functions"** (no menu lateral)
2. Clique em **"Create Function"** ou **"New Function"**
3. **Nome da função:** `criar-instancia-wuzapi-afiliado`
4. Clique em **"Create"**
5. Você verá um editor de código
6. **Apague todo o código** que está lá: `Ctrl + A` → `Delete`
7. Abra este arquivo no seu computador:
   ```
   C:\Users\usuario\hello-buddy-launchpad\supabase\functions\criar-instancia-wuzapi-afiliado\index.ts
   ```
8. **Copie todo o código:** `Ctrl + A` → `Ctrl + C`
9. **Cole no editor do Supabase:** `Ctrl + V`
10. Clique em **"Deploy"** ou **"Save"**
11. Aguarde alguns segundos (10-30 segundos)
12. Você verá uma mensagem de sucesso ✅

---

## ✅ Verificar se Funcionou

1. Na página da função, veja se aparece **"Active"** ou **"Deployed"**
2. Clique em **"Logs"** para ver se há erros
3. Teste no site: https://amzofertas.com.br/afiliado/conectar-celular

---

## 🆘 Se Der Erro

**Erro: "Secret not found"**
- Verifique se adicionou os secrets corretamente
- Os nomes devem ser exatamente: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`

**Erro: "Invalid code"**
- Verifique se copiou o código completo
- Não esqueça as primeiras linhas: `import { serve }...`

**Erro: "Function already exists"**
- Tudo certo! Só precisa atualizar o código

---

## 📝 Checklist

- [ ] Pegar service_role key (Settings → API)
- [ ] Adicionar secret `SUPABASE_URL`
- [ ] Adicionar secret `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Adicionar secret `CONTABO_WUZAPI_ADMIN_TOKEN` (opcional)
- [ ] Criar edge function `criar-instancia-wuzapi-afiliado`
- [ ] Colar código e fazer deploy
- [ ] Verificar se está "Active"
- [ ] Testar no site

---

**Vamos lá!** Me avise quando terminar ou se tiver alguma dúvida! 🚀
