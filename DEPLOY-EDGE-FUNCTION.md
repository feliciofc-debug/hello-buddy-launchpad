# 🚀 Como Fazer Deploy da Edge Function no Supabase

## 📋 Passo a Passo Simples

### Opção 1: Usando o Supabase CLI (Recomendado)

1. **Instalar Supabase CLI** (se não tiver):
   - Baixe em: https://github.com/supabase/cli/releases
   - Ou instale via npm: `npm install -g supabase`

2. **Fazer login no Supabase:**
   ```bash
   supabase login
   ```

3. **Linkar o projeto:**
   ```bash
   cd C:\Users\usuario\hello-buddy-launchpad
   supabase link --project-ref jibpvpqgplmahjhswiza
   ```

4. **Fazer deploy da função:**
   ```bash
   supabase functions deploy criar-instancia-wuzapi-afiliado
   ```

### Opção 2: Via Dashboard do Supabase (Mais Fácil)

1. **Acesse o Supabase Dashboard:**
   - Vá em: https://supabase.com/dashboard
   - Faça login
   - Selecione o projeto: `jibpvpqgplmahjhswiza`

2. **Vá em Edge Functions:**
   - No menu lateral, clique em **"Edge Functions"**
   - Procure por `criar-instancia-wuzapi-afiliado`

3. **Editar e Deploy:**
   - Clique na função
   - Clique em **"Edit"** ou **"Deploy"**
   - Cole o código do arquivo: `supabase/functions/criar-instancia-wuzapi-afiliado/index.ts`
   - Clique em **"Deploy"**

### Opção 3: Via GitHub (Automático)

Se o Supabase estiver conectado ao GitHub:
- Faça commit e push (já fizemos isso)
- O Supabase pode fazer deploy automático
- Verifique em: Supabase Dashboard → Edge Functions → Deployments

---

## ✅ Verificar se Funcionou

1. Vá em Supabase Dashboard → Edge Functions
2. Veja se `criar-instancia-wuzapi-afiliado` aparece como **"Active"**
3. Clique na função e veja os logs
4. Teste no site: https://amzofertas.com.br/afiliado/conectar-celular

---

## 🔧 Se Precisar Configurar Secrets

No Supabase Dashboard → Edge Functions → Secrets, verifique se estão configurados:

- `SUPABASE_URL` = `https://jibpvpqgplmahjhswiza.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (sua chave)
- `CONTABO_WUZAPI_ADMIN_TOKEN` = (seu token)

---

**Precisa de ajuda?** Me avise qual método você quer usar! 😊
