# ✅ Checklist do Kimi - Ordem de Execução

## 🎯 Siga Esta Ordem Exata

### 1. ✅ Verificar Variáveis no Vercel (JÁ FEITO)

- [x] `VITE_SUPABASE_URL` = `https://zunuqaidxffuhwmvcwul.supabase.co`
- [x] `VITE_SUPABASE_ANON_KEY` está configurada

---

### 2. 🔧 Rebuild Limpo (FAZER AGORA!)

**Opção A: Usar o Script (Mais Fácil)**

1. Abra o PowerShell na pasta do projeto
2. Execute:
   ```powershell
   .\rebuild-limpo.ps1
   ```

**Opção B: Manual**

No PowerShell, execute um por um:

```powershell
# Limpa TUDO
Remove-Item -Recurse -Force node_modules, .vercel, dist -ErrorAction SilentlyContinue

# Instala dependências
npm install

# Faz build
npm run build
```

---

### 3. 🧹 Limpar Cache do Supabase

1. Supabase Dashboard → Edge Functions
2. Clique em `criar-instancia-wuzapi-afiliado`
3. Vá em **Settings** ou **Configurações**
4. Procure por **"Clear cache"** ou **"Limpar cache"**
5. Clique e confirme

---

### 4. 🚀 Deploy no Vercel

**Opção A: Via Git (Recomendado)**

```powershell
git add .
git commit -m "Rebuild limpo - corrigir URL Supabase"
git push
```

**Opção B: Via Vercel CLI**

```powershell
npx vercel --prod -f
```

**Opção C: Via Dashboard**

1. Vercel Dashboard → Deployments
2. Clique nos 3 pontinhos do último deploy
3. Clique em **"Redeploy"**

---

### 5. 🧪 Testar

1. Limpe o cache do navegador (Ctrl + Shift + Delete)
2. Acesse: `https://amzofertas.com.br`
3. Abra o Console (F12)
4. Verifique se aparece:
   - ✅ `✅ [SUPABASE] Configurado: https://zunuqaidxffuhwmvcwul.supabase.co`
   - ❌ **NÃO** deve aparecer: `qbtqjrcfseqcfmcqlngr` ou `gbtqjrcfseqcfmcqlngr`

---

## 📋 Status

- [ ] Rebuild limpo feito
- [ ] Cache do Supabase limpo
- [ ] Deploy no Vercel feito
- [ ] Testado no navegador
- [ ] URL correta aparecendo no console

---

**Comece pelo rebuild limpo!** 🚀
