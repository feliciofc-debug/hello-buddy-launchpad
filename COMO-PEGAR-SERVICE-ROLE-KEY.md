# 🔑 Como Pegar a Service Role Key

## 🎯 Passo a Passo Simples

### 1. Acessar Supabase Dashboard

1. Vá para: **https://supabase.com/dashboard**
2. Faça login
3. Clique no projeto: **`amzofertas`** (ou o projeto `zunuqaidxffuhwmvcwul`)

### 2. Ir em Settings → API

1. No menu lateral esquerdo, clique em **"Settings"** (Configurações)
2. No submenu, clique em **"API"**

### 3. Encontrar a Service Role Key

Você verá uma página com várias chaves. Procure por:

**"service_role"** (não é a "anon"!)

Você verá algo assim:

```
Project API keys

anon / public
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (esta NÃO é!)

service_role (secret)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (esta É a que você precisa!)
```

### 4. Copiar a Chave

1. Ao lado de **"service_role"**, você verá a chave (uma string longa)
2. Clique no **ícone de olho** 👁️ para revelar (se estiver oculta)
3. Clique no **ícone de copiar** 📋 para copiar
4. **Cole em um lugar seguro** (vai precisar depois)

---

## ⚠️ IMPORTANTE

- ✅ Use a chave **"service_role"** (não a "anon")
- ⚠️ Esta chave é **SECRETA** - não compartilhe publicamente
- ✅ Você vai usar ela nas variáveis de ambiente da Edge Function

---

## 📋 Depois de Copiar

Você vai usar essa chave em:
- **Nome da variável:** `CHAVE_FUNÇÃO_DE_SERVIÇO`
- **Valor:** (cole a chave que você copiou)

---

**Siga esses passos e me avise quando encontrar!** 🚀
