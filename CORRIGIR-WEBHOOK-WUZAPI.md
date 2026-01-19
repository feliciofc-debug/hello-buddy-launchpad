# ⚠️ IMPORTANTE: Corrigir Webhook do Wuzapi

## 🔴 Problema

O **Wuzapi** (servidor em `https://api2.amzofertas.com.br`) precisa ter o **webhook configurado** para apontar para o **novo projeto Supabase**!

**Webhook ANTIGO (projeto antigo):**
```
https://gbtqircfseqcfmcqlngr.supabase.co/functions/v1/wuzapi-webhook-afiliados
```
ou
```
https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/wuzapi-webhook-afiliados
```

**Webhook NOVO (projeto novo):**
```
https://zunuqaidxffuhwmvcwul.supabase.co/functions/v1/wuzapi-webhook-afiliados
```

---

## ✅ Solução: Usar Edge Function para Corrigir

Temos uma Edge Function que corrige o webhook automaticamente!

### Opção 1: Executar via Supabase Dashboard

1. No Supabase Dashboard, vá em **Edge Functions**
2. Encontre a função: **`corrigir-webhook-contabo`**
3. Clique nela
4. Vá na aba **"Invoke"** ou **"Test"**
5. Clique em **"Invoke"** ou **"Run"**
6. Veja o resultado - deve mostrar que o webhook foi configurado

### Opção 2: Verificar Status Atual

1. No Supabase Dashboard, vá em **Edge Functions**
2. Encontre a função: **`verificar-contabo-wuzapi`**
3. Clique nela
4. Vá na aba **"Invoke"** ou **"Test"**
5. Clique em **"Invoke"** ou **"Run"**
6. Veja o resultado - mostra o webhook atual vs esperado

---

## 🔍 Verificar se Funcionou

Depois de executar `corrigir-webhook-contabo`:

1. Execute `verificar-contabo-wuzapi` novamente
2. Verifique se:
   - `webhookAtual` = `https://zunuqaidxffuhwmvcwul.supabase.co/functions/v1/wuzapi-webhook-afiliados`
   - `webhookCorreto` = `true`

---

## ⚠️ Se as Funções Não Existem

Se as funções `corrigir-webhook-contabo` ou `verificar-contabo-wuzapi` **não existirem** no novo projeto:

1. Precisamos criá-las no novo projeto
2. Ou configurar o webhook manualmente no servidor Wuzapi

---

## 📋 Checklist

- [ ] Verifiquei se as funções existem no novo projeto
- [ ] Executei `verificar-contabo-wuzapi` para ver status atual
- [ ] Executei `corrigir-webhook-contabo` para corrigir
- [ ] Verifiquei novamente com `verificar-contabo-wuzapi`
- [ ] Webhook está apontando para o novo projeto

---

**Verifique e me avise o que encontrou!** 🚀
