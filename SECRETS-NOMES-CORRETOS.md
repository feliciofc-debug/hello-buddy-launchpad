# ✅ Nomes Corretos dos Secrets

## ⚠️ Problema Identificado

O Supabase **NÃO permite** que secrets comecem com o prefixo `SUPABASE_`.

---

## ✅ Nomes Corretos para Usar

Use estes nomes:

### Secret 1:
- **Nome:** `PROJECT_URL`
- **Valor:** `https://zunuqaidxffuhwmvcwul.supabase.co`

### Secret 2:
- **Nome:** `SERVICE_ROLE_KEY`
- **Valor:** `sb_secret_7iHBiYYYurU2B1l94MbXMg_s6WCqdCC`

### Secret 3 (Opcional):
- **Nome:** `CONTABO_WUZAPI_ADMIN_TOKEN`
- **Valor:** (seu token do Wuzapi, se tiver)

---

## 🔧 O Que Fazer

1. **Apague** o nome `SUPABASE_URL` e coloque: `PROJECT_URL`
2. **Mantenha** o valor: `https://zunuqaidxffuhwmvcwul.supabase.co`
3. Clique em **"Adicione outro"**
4. Adicione:
   - **Nome:** `SERVICE_ROLE_KEY`
   - **Valor:** `sb_secret_7iHBiYYYurU2B1l94MbXMg_s6WCqdCC`
5. Clique em **"Salvar"**

---

## ✅ Verificar

Depois de salvar, você deve ver na lista:
- ✅ `PROJECT_URL`
- ✅ `SERVICE_ROLE_KEY`
- ⚠️ `CONTABO_WUZAPI_ADMIN_TOKEN` (opcional)

---

**Já atualizei o código da edge function para usar esses nomes!** 🚀
