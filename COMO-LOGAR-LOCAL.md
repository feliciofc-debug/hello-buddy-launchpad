# 🔐 Como Fazer Login no Localhost

## ⚠️ PROBLEMA

O site local está usando o **projeto NOVO** do Supabase (`zunuqaidxffuhwmvcwul`), mas sua conta está no **projeto ANTIGO**.

---

## ✅ SOLUÇÕES

### Opção 1: Criar Nova Conta (Mais Rápido)

1. No site local (`http://localhost:8080/`)
2. Clique em **"Cadastrar"** ou **"Criar Conta"**
3. Use o mesmo email que você usa no site original
4. Crie uma senha (pode ser a mesma ou diferente)
5. Faça login com a nova conta

---

### Opção 2: Verificar se Conta Já Existe

1. Acesse: https://supabase.com/dashboard/project/zunuqaidxffuhwmvcwul
2. Vá em **Authentication** → **Users**
3. Procure pelo seu email
4. Se existir, use **"Reset Password"** para criar nova senha

---

### Opção 3: Criar Usuário Direto no Supabase

1. Acesse: https://supabase.com/dashboard/project/zunuqaidxffuhwmvcwul
2. Vá em **Authentication** → **Users**
3. Clique em **"Add user"** → **"Create new user"**
4. Preencha:
   - Email: seu email
   - Password: sua senha
   - Auto Confirm User: ✅ (marcar)
5. Clique em **"Create user"**
6. Agora você pode fazer login no localhost

---

## 🧪 TESTAR LOGIN

Depois de criar a conta:

1. Acesse: `http://localhost:8080/`
2. Faça login com email e senha
3. Verifique no console (F12):
   - Deve aparecer: `✅ [SUPABASE CLIENT] Cliente criado`
   - Deve aparecer: `📍 [SUPABASE CLIENT] URL atual: https://zunuqaidxffuhwmvcwul.supabase.co`

---

## 📝 NOTA IMPORTANTE

- A conta do **site original** (produção) é diferente da conta do **localhost**
- Você pode usar o mesmo email, mas são contas separadas
- Depois que o site for para produção com o projeto novo, você precisará criar a conta novamente OU migrar os usuários

---

**Qual opção você quer tentar? Recomendo a Opção 1 (criar nova conta) para testar rapidamente!**
