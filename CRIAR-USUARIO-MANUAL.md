# 👤 Criar Usuário de Teste - INSTRUÇÕES SIMPLES

## 🎯 USUÁRIO DE TESTE

**Email:** `teste@amzofertas.com.br`  
**Senha:** `Teste123456`

---

## ✅ MÉTODO 1: Criar Manualmente (MAIS FÁCIL)

1. Acesse: https://supabase.com/dashboard/project/zunuqaidxffuhwmvcwul
2. Vá em **Authentication** → **Users**
3. Clique no botão **"Add user"** (canto superior direito)
4. Selecione **"Create new user"**
5. Preencha:
   - **Email:** `teste@amzofertas.com.br`
   - **Password:** `Teste123456`
   - **Auto Confirm User:** ✅ **MARCAR ESTA OPÇÃO** (importante!)
6. Clique em **"Create user"**
7. Pronto! Agora você pode fazer login no localhost

---

## ✅ MÉTODO 2: Usar SQL (Alternativo)

1. Acesse: https://supabase.com/dashboard/project/zunuqaidxffuhwmvcwul
2. Vá em **SQL Editor**
3. Clique em **"New query"**
4. Copie e cole o conteúdo do arquivo `CRIAR-USUARIO-TESTE.sql`
5. Clique em **"Run"** (ou pressione Ctrl+Enter)
6. Verifique se apareceu "Success"
7. Faça login no localhost com:
   - Email: `teste@amzofertas.com.br`
   - Senha: `Teste123456`

---

## 🧪 TESTAR LOGIN

1. Abra: `http://localhost:8080/`
2. Clique em **"Entrar"** ou vá para `/login`
3. Digite:
   - Email: `teste@amzofertas.com.br`
   - Senha: `Teste123456`
4. Clique em **"Entrar"**
5. Deve funcionar! ✅

---

## 🔍 VERIFICAR NO CONSOLE

Depois de fazer login, abra o Console (F12) e verifique:

```
✅ [SUPABASE CLIENT] Cliente criado
📍 [SUPABASE CLIENT] URL atual: https://zunuqaidxffuhwmvcwul.supabase.co
```

Se aparecer isso, está tudo certo! 🎉

---

**Recomendo o MÉTODO 1 (criar manualmente) - é mais rápido e fácil!**
