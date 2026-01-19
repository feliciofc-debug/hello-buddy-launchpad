# 🔧 Solução Definitiva para Erro 401

## 🎯 Problema
O navegador estava usando a URL antiga do Bolt (`gbtqjrcfseqcfmcqlngr.supabase.co`) em vez da correta (`jibpvpqgplmahjhswiza.supabase.co`), causando erro 401.

## ✅ Solução Aplicada - Interceptores em 3 Níveis

### 1. Interceptor no HTML (`index.html`)
- ✅ Executa **ANTES** de qualquer JavaScript
- ✅ Intercepta todas as requisições `fetch()`
- ✅ Corrige automaticamente URLs antigas

### 2. Interceptor no Main (`src/main.tsx`)
- ✅ Executa antes do React carregar
- ✅ Segunda camada de proteção

### 3. Interceptor no Cliente Supabase (`src/integrations/supabase/client.ts`)
- ✅ Força URL correta no cliente
- ✅ Intercepta requisições do Supabase

## 🚀 O Que Fazer Agora

### Passo 1: Fazer Deploy na Vercel

**IMPORTANTE:** As mudanças precisam ser deployadas para funcionar!

1. **Commit e Push:**
   ```bash
   git add .
   git commit -m "fix: corrige URL Supabase e adiciona interceptores"
   git push
   ```

2. **Ou fazer deploy manual na Vercel:**
   - Vá em Vercel Dashboard
   - Clique em "Redeploy" no último deploy
   - Aguarde o deploy completar

### Passo 2: Limpar Cache COMPLETO

**Método 1 - Limpar Tudo:**
1. Pressione `Ctrl + Shift + Delete`
2. Selecione:
   - ✅ Imagens e arquivos em cache
   - ✅ Cookies e outros dados do site
   - ✅ Dados de aplicativos hospedados
3. Período: **Todo o período**
4. Clique em **Limpar dados**

**Método 2 - Limpar localStorage e sessionStorage:**
1. Abra o console (F12)
2. Execute:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

**Método 3 - Janela Anônima:**
1. `Ctrl + Shift + N` (Chrome)
2. Acesse o site
3. Faça login

### Passo 3: Verificar Service Workers

1. Abra DevTools (F12)
2. Vá em **Application** → **Service Workers**
3. Se houver algum registrado:
   - Clique em **Unregister**
   - Marque **"Bypass for network"**
4. Recarregue a página

### Passo 4: Verificar no Console

Após limpar o cache e recarregar, você deve ver:

```
✅ [HTML] Interceptor de fetch instalado no HTML (executado primeiro)
✅ [MAIN] Interceptor de fetch instalado no início da aplicação
✅ [SUPABASE] Configurado: https://jibpvpqgplmahjhswiza.supabase.co
✅ [SUPABASE] Cliente criado com URL: https://jibpvpqgplmahjhswiza.supabase.co
```

**Se ainda aparecer URL antiga:**
- O interceptor deve corrigir automaticamente
- Você verá: `🔧 [HTML] Interceptor corrigiu URL antiga: ... → ...`

### Passo 5: Testar

1. Faça login novamente
2. Vá em `/afiliado/conectar-celular`
3. Clique em "Criar Instância"
4. Verifique o console - não deve aparecer erro 401

## 🔍 Debug - Verificar se Funcionou

### No Console, verifique:

1. **Interceptores instalados:**
   ```
   ✅ [HTML] Interceptor de fetch instalado...
   ✅ [MAIN] Interceptor de fetch instalado...
   ✅ [INTERCEPTOR] Interceptor de fetch instalado
   ```

2. **URL correta:**
   ```
   ✅ [SUPABASE] Configurado: https://jibpvpqgplmahjhswiza.supabase.co
   ```

3. **Se URL antiga aparecer, deve ser corrigida:**
   ```
   🔧 [HTML] Interceptor corrigiu URL antiga: gbtqjrcfseqcfmcqlngr... → jibpvpqgplmahjhswiza...
   ```

### Na Aba Network (F12 → Network):

1. Clique em "Criar Instância"
2. Procure pela requisição `criar-instancia-wuzapi-afiliado`
3. Verifique:
   - **URL deve ser:** `https://jibpvpqgplmahjhswiza.supabase.co/...`
   - **NÃO deve ser:** `gbtqjrcfseqcfmcqlngr.supabase.co`
   - **Status deve ser:** 200 (não 401)

## ⚠️ Se Ainda Não Funcionar

### 1. Verificar se o Deploy Foi Feito

- Acesse: `https://amzofertas.com.br`
- Abra o console
- Verifique se aparece: `✅ [HTML] Interceptor de fetch instalado...`
- Se NÃO aparecer, o deploy ainda não foi feito

### 2. Forçar Atualização do Build

```bash
# No terminal:
cd C:\Users\usuario\hello-buddy-launchpad
npm run build
# Depois fazer deploy do build
```

### 3. Verificar Variáveis de Ambiente na Vercel

1. Vá em Vercel Dashboard → Seu Projeto → Settings → Environment Variables
2. Verifique se estão configuradas:
   - `VITE_SUPABASE_URL` = `https://jibpvpqgplmahjhswiza.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (sua chave)

### 4. Teste Manual no Console

```javascript
// Teste se o interceptor está funcionando:
fetch('https://gbtqjrcfseqcfmcqlngr.supabase.co/test')
  .catch(e => console.log('Erro esperado:', e))

// Deve aparecer no console:
// 🔧 [HTML] Interceptor corrigiu URL antiga: ...
```

## 📝 Checklist Final

- [ ] Código commitado e pushado
- [ ] Deploy feito na Vercel
- [ ] Cache do navegador limpo completamente
- [ ] Service Workers desregistrados
- [ ] localStorage limpo
- [ ] Login feito novamente
- [ ] Console mostra interceptores instalados
- [ ] Console mostra URL correta
- [ ] Network mostra requisições para URL correta
- [ ] Erro 401 não aparece mais

## 🎉 Resultado Esperado

Após seguir todos os passos:
- ✅ Não deve aparecer erro 401
- ✅ "Criar Instância" deve funcionar
- ✅ QR Code deve aparecer
- ✅ Conexão WhatsApp deve funcionar

---

**Última atualização:** Agora
**Versão:** 2.0 (Solução Definitiva com Interceptores)
