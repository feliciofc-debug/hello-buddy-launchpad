# 🚀 Guia Simples de Deploy - Passo a Passo

## 📋 O Que Você Precisa Fazer

Fazer o deploy é como "enviar" suas mudanças para o servidor (Vercel) para que o site funcione online.

---

## 🎯 MÉTODO 1: Usando o Terminal (Mais Rápido)

### Passo 1: Abrir o Terminal

1. Pressione `Windows + R`
2. Digite: `powershell`
3. Pressione Enter

### Passo 2: Ir para a Pasta do Projeto

No terminal que abriu, digite:

```powershell
cd C:\Users\usuario\hello-buddy-launchpad
```

Pressione Enter.

### Passo 3: Adicionar as Mudanças

Digite:

```powershell
git add .
```

Pressione Enter. (Isso prepara as mudanças para serem enviadas)

### Passo 4: Salvar as Mudanças (Commit)

Digite:

```powershell
git commit -m "Corrige URL Supabase e erro 401"
```

Pressione Enter. (Isso salva as mudanças localmente)

### Passo 5: Enviar para o Servidor (Push)

Digite:

```powershell
git push
```

Pressione Enter. (Isso envia as mudanças para o GitHub/Vercel)

**Pronto!** 🎉 A Vercel vai detectar automaticamente e fazer o deploy!

---

## 🎯 MÉTODO 2: Usando a Interface do GitHub (Mais Visual)

### Se você tem o GitHub Desktop instalado:

1. Abra o **GitHub Desktop**
2. Você verá as mudanças listadas na esquerda
3. Na parte inferior, escreva uma mensagem: `Corrige URL Supabase e erro 401`
4. Clique em **"Commit to main"**
5. Clique em **"Push origin"** (botão azul no topo)

**Pronto!** 🎉 A Vercel vai fazer o deploy automaticamente!

---

## 🎯 MÉTODO 3: Deploy Manual na Vercel (Se os outros não funcionarem)

### Passo 1: Acessar a Vercel

1. Abra o navegador
2. Vá para: https://vercel.com
3. Faça login na sua conta

### Passo 2: Encontrar Seu Projeto

1. Na dashboard da Vercel, encontre o projeto **"hello-buddy-launchpad"** ou **"amzofertas"**
2. Clique nele

### Passo 3: Fazer Redeploy

1. Vá na aba **"Deployments"** (Deploys)
2. Encontre o último deploy (o mais recente)
3. Clique nos **3 pontinhos** (⋯) ao lado
4. Clique em **"Redeploy"**
5. Confirme clicando em **"Redeploy"** novamente

**Pronto!** 🎉 O site será atualizado!

---

## ⏱️ Quanto Tempo Demora?

- **Deploy automático (git push):** 2-5 minutos
- **Redeploy manual:** 1-3 minutos

Você pode acompanhar o progresso na página da Vercel.

---

## ✅ Como Saber se Funcionou?

### 1. Verificar na Vercel:

- Vá na página do projeto na Vercel
- Veja se aparece "Building..." e depois "Ready" ✅

### 2. Verificar no Site:

1. Aguarde 2-5 minutos após o push
2. Acesse: https://amzofertas.com.br
3. Pressione `Ctrl + F5` (recarregar sem cache)
4. Abra o console (F12)
5. Procure por: `✅ [HTML] Interceptor de fetch instalado...`

Se aparecer essa mensagem, o deploy funcionou! 🎉

---

## 🆘 Se Der Erro

### Erro: "git não é reconhecido"

**Solução:** Instale o Git:
1. Baixe em: https://git-scm.com/download/win
2. Instale (só clicar "Next" em tudo)
3. Reinicie o terminal
4. Tente novamente

### Erro: "não autorizado" ou "permission denied"

**Solução:** Você precisa estar logado no Git:
```powershell
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@gmail.com"
```

### Erro: "nothing to commit"

**Solução:** As mudanças já foram enviadas! Tudo certo! ✅

---

## 📝 Checklist Rápido

- [ ] Terminal aberto
- [ ] Pasta do projeto acessada (`cd C:\Users\usuario\hello-buddy-launchpad`)
- [ ] `git add .` executado
- [ ] `git commit -m "..."` executado
- [ ] `git push` executado
- [ ] Aguardado 2-5 minutos
- [ ] Verificado no site se funcionou

---

## 💡 Dica

**Sempre que fizer mudanças no código:**
1. `git add .`
2. `git commit -m "Descrição do que mudou"`
3. `git push`

Isso mantém o site sempre atualizado! 🚀

---

**Precisa de ajuda?** Me avise qual erro apareceu que eu te ajudo! 😊
