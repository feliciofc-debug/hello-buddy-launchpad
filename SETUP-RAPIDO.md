# ⚡ Setup Rápido - Trabalhar com Cursor

## 🚀 Passo a Passo Rápido

### 1. Instalar Dependências
```bash
cd C:\Users\usuario\hello-buddy-launchpad
npm install
```

### 2. Criar Arquivo de Variáveis de Ambiente
Crie o arquivo `.env.local` na raiz do projeto com:
```env
VITE_SUPABASE_URL=https://jibpvpqgplmahjhswiza.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-aqui
```

### 3. Testar Localmente
```bash
npm run dev
```
Abra: http://localhost:8080

### 4. Conectar Vercel (se ainda não conectou)

**Opção A: Via Dashboard**
1. Acesse: https://vercel.com/dashboard
2. Clique: "Add New Project"
3. Importe: `feliciofc-debug/hello-buddy-launchpad`
4. Configure:
   - Framework: **Vite**
   - Build: `npm run build`
   - Output: `dist`

**Opção B: Via CLI**
```bash
npm i -g vercel
vercel login
vercel
```

### 5. Configurar Variáveis na Vercel
No dashboard da Vercel:
- Settings → Environment Variables
- Adicione: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

### 6. Pronto! 🎉

Agora você pode:
- Me pedir mudanças aqui no Cursor
- Eu faço o código
- Você faz: `git add . && git commit -m "mensagem" && git push`
- Vercel faz deploy automático!

---

## 📝 Comandos Úteis

```bash
# Desenvolvimento
npm run dev          # Rodar localmente
npm run build        # Build para produção
npm run preview      # Preview do build

# Git
git status           # Ver mudanças
git add .            # Adicionar tudo
git commit -m "msg"  # Commit
git push             # Enviar para GitHub
```

---

## ❓ Precisa de Ajuda?

Me pergunte aqui mesmo! Estou pronto para ajudar. 🚀

