# 🔧 Correção do Erro 401 - Wuzapi Connection

## 📋 Problema Identificado

O erro **401 Unauthorized** estava ocorrendo porque:

1. **URL antiga do Bolt em cache**: O navegador estava usando a URL antiga `qbtqjrcfseqcfmcqlngr.supabase.co` em vez da correta `jibpvpqgplmahjhswiza.supabase.co`
2. **Token de autenticação não sendo enviado**: O cliente Supabase pode não estar enviando o token automaticamente em algumas situações

## ✅ Correções Aplicadas

### 1. Cliente Supabase (`src/integrations/supabase/client.ts`)
- ✅ Forçada URL correta do Supabase (mesmo se houver cache)
- ✅ Adicionados logs de debug para verificar configuração
- ✅ Validação automática da URL

### 2. Componente de Conexão (`src/components/AfiliadoWhatsAppConnection.tsx`)
- ✅ Verificação de autenticação antes de chamar funções
- ✅ Tratamento específico para erros 401
- ✅ Tentativa de refresh de sessão quando necessário
- ✅ Logs detalhados para debug

### 3. Página de Conexão (`src/pages/afiliado/AfiliadoConectarCelular2.tsx`)
- ✅ Verificação de autenticação em todas as funções
- ✅ Tratamento de erros 401
- ✅ Logs de debug

## 🚀 Como Resolver o Erro 401

### Passo 1: Limpar Cache do Navegador

**Opção A - Limpar Cache Completo:**
1. Pressione `Ctrl + Shift + Delete` (Windows) ou `Cmd + Shift + Delete` (Mac)
2. Selecione "Imagens e arquivos em cache"
3. Período: "Todo o período"
4. Clique em "Limpar dados"

**Opção B - Usar Janela Anônima:**
1. Pressione `Ctrl + Shift + N` (Chrome) ou `Ctrl + Shift + P` (Firefox)
2. Acesse o site na janela anônima
3. Faça login novamente

### Passo 2: Verificar Service Workers (se aplicável)

1. Abra DevTools (F12)
2. Vá em **Application** → **Service Workers**
3. Se houver service workers registrados, clique em **Unregister**
4. Recarregue a página

### Passo 3: Verificar Console do Navegador

1. Abra o console (F12 → Console)
2. Procure por estas mensagens:
   - ✅ `✅ [SUPABASE] Configurado: https://jibpvpqgplmahjhswiza.supabase.co`
   - ✅ `✅ [Frontend] Sessão válida, token: ...`
   - ✅ `✅ [Frontend] Usuário autenticado: ...`

3. Se aparecer URL antiga (`qbtqjrcfseqcfmcqlngr`), o cache ainda está ativo

### Passo 4: Fazer Login Novamente

1. Faça **logout** completo
2. Limpe o localStorage (opcional):
   ```javascript
   // No console do navegador:
   localStorage.clear()
   ```
3. Faça **login** novamente
4. Tente criar a instância

### Passo 5: Rebuild do Projeto (se rodando localmente)

```bash
cd C:\Users\usuario\hello-buddy-launchpad
npm install
npm run build
npm run dev
```

## 🔍 Debug - Verificar se Está Funcionando

### No Console do Navegador, você deve ver:

```
✅ [SUPABASE] Configurado: https://jibpvpqgplmahjhswiza.supabase.co
✅ [SUPABASE] URL esperada: https://jibpvpqgplmahjhswiza.supabase.co
✅ [Frontend] Sessão válida, token: eyJhbGciOiJIUzI1NiIs...
✅ [Frontend] Usuário autenticado: seu-email@exemplo.com
📤 [Frontend] Chamando criar-instancia-wuzapi-afiliado com action: status
```

### Se aparecer erro 401, verifique:

1. **Token está sendo enviado?**
   - Abra DevTools → Network
   - Clique em "Criar Instância"
   - Veja a requisição para `criar-instancia-wuzapi-afiliado`
   - Verifique se há header `Authorization: Bearer ...`

2. **Sessão está válida?**
   - No console: `await supabase.auth.getSession()`
   - Deve retornar um objeto com `session` não nulo

3. **URL está correta?**
   - A requisição deve ir para: `https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/criar-instancia-wuzapi-afiliado`
   - **NÃO** deve ir para: `qbtqjrcfseqcfmcqlngr.supabase.co`

## 📝 Checklist de Verificação

- [ ] Cache do navegador limpo
- [ ] Service Workers desregistrados (se houver)
- [ ] Login feito novamente
- [ ] Console mostra URL correta do Supabase
- [ ] Console mostra sessão válida
- [ ] Requisição Network mostra header Authorization
- [ ] Erro 401 não aparece mais

## 🆘 Se o Problema Persistir

1. **Verifique as variáveis de ambiente no Supabase:**
   - Vá em Supabase Dashboard → Project Settings → Edge Functions
   - Verifique se `SUPABASE_URL` está correto
   - Verifique se `SUPABASE_SERVICE_ROLE_KEY` está configurado

2. **Verifique o arquivo .env local:**
   ```env
   VITE_SUPABASE_URL="https://jibpvpqgplmahjhswiza.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIs..."
   ```

3. **Teste a autenticação manualmente:**
   ```javascript
   // No console do navegador:
   const { data, error } = await supabase.auth.getUser()
   console.log('User:', data?.user)
   console.log('Error:', error)
   ```

4. **Teste a edge function diretamente:**
   ```javascript
   // No console do navegador:
   const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-afiliado', {
     body: { action: 'status' }
   })
   console.log('Response:', data)
   console.log('Error:', error)
   ```

## 📞 Suporte

Se após seguir todos os passos o erro persistir, forneça:
1. Screenshot do console do navegador
2. Screenshot da aba Network (requisição que falha)
3. Logs do console completos

---

**Última atualização:** $(date)
**Versão:** 1.0
