# ✅ Projeto Criado! Agora Vamos Configurar

## 🎯 Informações do Novo Projeto

**Nome:** `amzofertas`  
**ID:** `zunuqaidxffuhwmvcwul`  
**URL:** `https://zunuqaidxffuhwmvcwul.supabase.co`  
**Publishable Key:** `sb_publishable_BT7lsfrAYrPII7bsH_I6WA_zmDkhorc`

---

## 📋 Próximos Passos

### 1️⃣ Aguardar o Projeto Terminar de Provisionar

O projeto está em "building". Aguarde 2-3 minutos até aparecer "Ready".

### 2️⃣ Pegar a Service Role Key

Depois que o projeto estiver pronto:

1. Vá em **Settings** → **API**
2. Procure por **"service_role key"** (secret key)
3. **Copie essa chave** (ela é diferente da publishable key)
4. Você vai precisar dela para configurar os secrets

### 3️⃣ Atualizar Variáveis no Vercel

1. Vá para: **https://vercel.com/dashboard**
2. Clique no seu projeto (amzofertas)
3. Vá em **Settings** → **Environment Variables**
4. **Edite** a variável `VITE_SUPABASE_URL`:
   - Valor novo: `https://zunuqaidxffuhwmvcwul.supabase.co`
   - Clique em **Save**
5. **Edite** a variável `VITE_SUPABASE_ANON_KEY`:
   - Valor novo: `sb_publishable_BT7lsfrAYrPII7bsH_I6WA_zmDkhorc`
   - Clique em **"Save"**
6. **IMPORTANTE:** Depois de salvar, faça um novo deploy:
   - Vá em **Deployments**
   - Clique nos **3 pontinhos** do último deploy
   - Clique em **"Redeploy"**

### 4️⃣ Configurar Secrets no Supabase (Para Edge Functions)

1. No Supabase Dashboard, aguarde o projeto terminar de provisionar
2. Vá em **Settings** → **Edge Functions** → **Secrets**
3. Adicione os seguintes secrets:
   - **SUPABASE_URL:** `https://zunuqaidxffuhwmvcwul.supabase.co`
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

### 6️⃣ Atualizar o Código Local

Vou atualizar o código para usar o novo projeto:

1. Atualizar `src/integrations/supabase/client.ts` com a nova URL e chave
2. Fazer commit e push
3. O Vercel vai fazer deploy automaticamente

---

## ⚠️ Observação Importante

Vejo que a organização está como **"FREE"**, mas você mencionou que contratou um plano **Pro**. 

**Verifique:**
- Se o plano Pro foi aplicado ao projeto
- Se não, você pode precisar atualizar o plano depois

---

## ✅ Checklist

- [ ] Aguardar projeto terminar de provisionar
- [ ] Pegar a service_role key (Settings → API)
- [ ] Atualizar variáveis no Vercel
- [ ] Fazer redeploy no Vercel
- [ ] Configurar secrets no Supabase
- [ ] Fazer deploy da edge function
- [ ] Atualizar código local

---

**Me avise quando o projeto terminar de provisionar e eu te ajudo com os próximos passos!** 🚀
