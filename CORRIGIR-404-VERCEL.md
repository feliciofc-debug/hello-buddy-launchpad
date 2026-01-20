# 🔧 CORRIGIR ERRO 404 NO VERCEL

## ⚠️ PROBLEMA

O site está retornando **404: NOT_FOUND** quando acessa rotas como `/login`.

---

## ✅ SOLUÇÃO: 2 PASSOS

### PASSO 1: Verificar se o vercel.json foi commitado

O arquivo `vercel.json` já foi criado na raiz do projeto com:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

### PASSO 2: Forçar Redeploy no Vercel (OBRIGATÓRIO!)

1. Acesse: https://vercel.com
2. Vá no seu projeto → **Deployments**
3. Último deploy → **3 pontinhos** (⋮) → **"Redeploy"**
4. **⚠️ DESMARQUE** "Use existing Build Cache"
5. Clique em **"Redeploy"**
6. Aguarde terminar (2-3 minutos)

---

## 🔍 VERIFICAR SE FUNCIONOU

1. Aguarde o deploy terminar
2. Acesse: https://amzofertas.com.br/login
3. **NÃO deve mais aparecer** erro 404
4. A página de login deve carregar normalmente

---

## ⚠️ SE AINDA NÃO FUNCIONAR

Se ainda der 404 após o redeploy:

1. Vercel → **Settings** → **General**
2. Verifique se o **"Framework Preset"** está como **"Vite"** ou **"Other"**
3. Verifique se o **"Build Command"** está como `npm run build`
4. Verifique se o **"Output Directory"** está como `dist`
5. **SALVE** e faça redeploy novamente

---

**Faça o redeploy AGORA e me avise o resultado!**
