# 🧹 Limpar Duplicatas de Secrets

## 🔴 Problema

Você tem **2 entradas** de `URL_DO_PROJETO` e **2 entradas** de `CHAVE_FUNÇÃO_DE_SERVIÇO`.

Isso pode causar confusão. Vamos manter apenas as **mais recentes** (atualizadas hoje às 19:53 e 19:54).

---

## ✅ O Que Fazer

### Manter (As Mais Recentes):

1. **`URL_DO_PROJETO`** - Atualizado: `19 de janeiro de 2026 19:53:34` ✅
2. **`CHAVE_FUNÇÃO_DE_SERVIÇO`** - Atualizado: `19 de janeiro de 2026 19:54:24` ✅

### Deletar (As Antigas):

1. **`URL_DO_PROJETO`** - Atualizado: `19 de janeiro de 2026 12:58:24` ❌ (deletar)
2. **`CHAVE_FUNÇÃO_DE_SERVIÇO`** - Atualizado: `19 de janeiro de 2026 12:58:24` ❌ (deletar)

---

## 🗑️ Como Deletar

1. Na lista de Secrets, encontre a entrada antiga de `URL_DO_PROJETO` (a de 12:58:24)
2. Clique nos **3 pontinhos** (⋯) ao lado dela
3. Clique em **"Delete"** ou **"Excluir"**
4. Confirme

5. Faça o mesmo para a entrada antiga de `CHAVE_FUNÇÃO_DE_SERVIÇO` (a de 12:58:24)

---

## ✅ Verificar Valores das Mais Recentes

Antes de deletar, verifique se as mais recentes estão corretas:

**`URL_DO_PROJETO` (19:53:34):**
- Deve ser: `https://zunuqaidxffuhwmvcwul.supabase.co`

**`CHAVE_FUNÇÃO_DE_SERVIÇO` (19:54:24):**
- Deve começar com: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## 📋 Checklist

- [ ] Verifiquei que as mais recentes estão corretas
- [ ] Deletei a `URL_DO_PROJETO` antiga (12:58:24)
- [ ] Deletei a `CHAVE_FUNÇÃO_DE_SERVIÇO` antiga (12:58:24)
- [ ] Fiz Redeploy da função

---

**Delete as duplicatas antigas e me avise!** 🚀
