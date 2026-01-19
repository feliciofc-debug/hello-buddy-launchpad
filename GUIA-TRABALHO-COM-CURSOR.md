# 🚀 Guia Completo: Trabalhando com Cursor + Vercel

## 📋 Visão Geral

Este guia explica como trabalhar comigo (Cursor AI) para atualizar seu site que está hospedado na Vercel com domínio na Hostinger.

---

## 🎯 Workflow de Trabalho

### Fluxo Simplificado:
```
Você pede uma mudança → Eu faço o código → Commit no GitHub → Vercel faz deploy automático → Site atualizado!
```

---

## 🔧 Configuração Inicial

### 1. Instalar Dependências Localmente

```bash
cd C:\Users\usuario\hello-buddy-launchpad
npm install
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://jibpvpqgplmahjhswiza.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

**⚠️ IMPORTANTE:** O arquivo `.env.local` já está no `.gitignore`, então suas chaves não serão commitadas.

### 3. Rodar o Projeto Localmente

```bash
npm run dev
```

O site vai abrir em `http://localhost:5173` (ou outra porta que o Vite escolher).

---

## 🔄 Como Trabalhar Comigo (Cursor)

### Passo a Passo:

1. **Você me pede uma mudança**
   - Exemplo: "Adicione um botão de contato na página inicial"
   - Exemplo: "Corrija o erro de envio para WhatsApp"

2. **Eu faço as alterações**
   - Edito os arquivos necessários
   - Mostro o que estou fazendo em tempo real
   - Explico as mudanças

3. **Você revisa**
   - Vejo as mudanças no código
   - Testo localmente se quiser (`npm run dev`)

4. **Commit e Push**
   ```bash
   git add .
   git commit -m "descrição da mudança"
   git push
   ```

5. **Vercel faz deploy automático**
   - Se o projeto está conectado ao GitHub, a Vercel detecta o push
   - Faz build e deploy automaticamente
   - Em 1-2 minutos, seu site está atualizado!

---

## 🌐 Configuração Vercel

### Conectar Projeto GitHub → Vercel

1. **Acesse:** https://vercel.com/dashboard
2. **Clique em:** "Add New Project"
3. **Importe o repositório:** `feliciofc-debug/hello-buddy-launchpad`
4. **Configure:**
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### Variáveis de Ambiente na Vercel

No dashboard da Vercel, vá em:
- **Settings** → **Environment Variables**
- Adicione as mesmas variáveis do `.env.local`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### Deploy Automático

A Vercel automaticamente:
- ✅ Faz deploy quando você faz `git push` na branch `main`
- ✅ Cria previews para Pull Requests
- ✅ Notifica você por email quando o deploy termina

---

## 🔗 Configuração Domínio Hostinger

### Conectar Domínio na Vercel

1. **Na Vercel:**
   - Vá em **Settings** → **Domains**
   - Adicione seu domínio: `amzofertas.com.br`

2. **Na Hostinger:**
   - Acesse o painel de DNS
   - Adicione/edite os registros:

   **Tipo A:**
   ```
   Nome: @
   Valor: 76.76.21.21
   TTL: 3600
   ```

   **Tipo CNAME:**
   ```
   Nome: www
   Valor: cname.vercel-dns.com
   TTL: 3600
   ```

   **OU use os valores que a Vercel fornecer** (eles podem mudar)

3. **Aguardar propagação DNS:**
   - Pode levar de 5 minutos a 48 horas
   - Geralmente funciona em 1-2 horas

---

## 📝 Comandos Úteis

### Desenvolvimento Local
```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build para produção (testar localmente)
npm run build
npm run preview
```

### Git (Trabalhando comigo)
```bash
# Ver mudanças
git status
git diff

# Adicionar mudanças
git add .

# Commit
git commit -m "descrição clara da mudança"

# Enviar para GitHub
git push

# Ver histórico
git log --oneline -10
```

### Vercel CLI (Opcional)
```bash
# Instalar Vercel CLI
npm i -g vercel

# Fazer login
vercel login

# Deploy manual (se necessário)
vercel

# Ver logs
vercel logs
```

---

## 🐛 Troubleshooting

### Problema: Site não atualiza na Vercel

**Solução:**
1. Verifique se fez `git push`
2. Veja os logs na Vercel Dashboard
3. Verifique se o build passou (pode ter erro de compilação)

### Problema: Variáveis de ambiente não funcionam

**Solução:**
1. Verifique se adicionou na Vercel Dashboard
2. Faça um novo deploy após adicionar
3. Variáveis começam com `VITE_` para serem expostas no frontend

### Problema: Domínio não conecta

**Solução:**
1. Verifique DNS na Hostinger
2. Use ferramenta: https://dnschecker.org
3. Aguarde propagação (pode levar horas)

---

## ✅ Checklist de Setup

- [ ] Projeto clonado localmente
- [ ] `npm install` executado
- [ ] `.env.local` criado com variáveis
- [ ] `npm run dev` funciona localmente
- [ ] Projeto conectado na Vercel
- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] Domínio configurado na Hostinger
- [ ] Deploy automático funcionando

---

## 🎉 Pronto para Trabalhar!

Agora você pode:
1. Me pedir qualquer mudança no site
2. Eu faço o código
3. Você faz commit e push
4. Vercel atualiza automaticamente!

**Exemplo de pedido:**
- "Adicione um formulário de contato"
- "Mude a cor do botão principal para azul"
- "Corrija o bug de envio de mensagens"
- "Adicione uma nova página de produtos"

---

## 📞 Suporte

Se tiver dúvidas sobre:
- **Cursor/Git:** Me pergunte aqui mesmo!
- **Vercel:** https://vercel.com/docs
- **Hostinger:** Suporte da Hostinger

---

**Última atualização:** Janeiro 2026
**Versão:** 1.0

