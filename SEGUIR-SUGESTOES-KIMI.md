# ✅ Seguir Sugestões do Kimi

## 🎯 Checklist do Kimi

### 1. ✅ Verificar Variáveis no Vercel

1. Vercel Dashboard → Seu Projeto → Settings → Environment Variables
2. Verifique se tem:
   ```
   VITE_SUPABASE_URL=https://zunuqaidxffuhwmvcwul.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```
3. Se tiver outra, **APAGUE** e salve

### 2. 🔧 Rebuild Limpo (No Terminal)

Abra o terminal na pasta do projeto e execute:

```bash
# Limpa TUDO
rm -rf node_modules .vercel dist
npm install
npm run build

# Re-deploy forçado
npx vercel --prod -f
```

**OU no PowerShell (Windows):**
```powershell
# Limpa TUDO
Remove-Item -Recurse -Force node_modules, .vercel, dist -ErrorAction SilentlyContinue
npm install
npm run build

# Re-deploy forçado
npx vercel --prod -f
```

### 3. 🔍 Verificar Edge Function

Já verifiquei o código da Edge Function - está usando variáveis de ambiente corretamente! ✅

### 4. 🧹 Limpar Cache do Supabase

1. Supabase Dashboard → Edge Functions
2. Clique em `criar-instancia-wuzapi-afiliado`
3. Vá em **Settings** ou **Configurações**
4. Procure por **"Clear cache"** ou **"Limpar cache"**
5. Clique e confirme

### 5. 🧪 Testar Edge Function Diretamente

No terminal, execute (substitua o token):

```bash
curl -X POST https://zunuqaidxffuhwmvcwul.supabase.co/functions/v1/criar-instancia-wuzapi-afiliado \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"action":"status"}'
```

---

## 📋 Ordem de Execução

1. ✅ Verificar variáveis no Vercel (já feito antes)
2. 🔧 Fazer rebuild limpo (MAIS IMPORTANTE!)
3. 🧹 Limpar cache do Supabase
4. 🧪 Testar edge function
5. 🔄 Fazer novo deploy no Vercel

---

**Vamos começar pelo rebuild limpo!** 🚀
