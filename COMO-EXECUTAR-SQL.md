# ✅ Como Executar o Script SQL no Supabase

## 🚀 Passo a Passo Simples

### 1. Abrir SQL Editor

1. No Supabase Dashboard, vá em **"Database"** (menu lateral)
2. Clique em **"SQL Editor"** (ou procure por "SQL Editor" no menu)

### 2. Criar Nova Query

1. Clique no botão **"New query"** ou **"+"** (canto superior direito)
2. Uma nova aba de código SQL aparecerá

### 3. Colar o Script

1. Abra o arquivo `CRIAR-TABELAS-SQL.sql` que criei
2. **Selecione TODO o conteúdo** (Ctrl+A)
3. **Copie** (Ctrl+C)
4. **Cole** no SQL Editor do Supabase (Ctrl+V)

### 4. Executar

1. Clique no botão **"Run"** ou **"Execute"** (geralmente um botão verde ou ícone de play ▶️)
2. Aguarde alguns segundos
3. Você verá uma mensagem de sucesso: **"Success. No rows returned"** ou similar

### 5. Verificar

1. Vá em **"Database"** → **"Tables"**
2. Você deve ver as tabelas:
   - ✅ `clientes_afiliados`
   - ✅ `wuzapi_tokens_afiliados`

---

## ✅ Pronto!

Depois de executar o script, as tabelas estarão criadas e o erro 500 deve ser resolvido!

---

## ⚠️ Se Der Erro

Se aparecer algum erro ao executar:
- **Me envie o erro completo** que aparecer
- Geralmente é porque alguma tabela já existe (mas isso é normal, o script usa `IF NOT EXISTS`)

---

**Execute o script e me avise se funcionou!** 🚀
