# 🆘 PROMPT PARA CLAUDE - PROBLEMA CRÍTICO DE URL PERSISTENTE

## 📋 CONTEXTO DO PROBLEMA

Estou enfrentando um problema **EXTREMAMENTE persistente** onde o frontend React/Vite continua fazendo requisições para uma URL antiga do Supabase, apesar de:
- ✅ Ter atualizado todas as variáveis de ambiente no Vercel
- ✅ Ter implementado múltiplos interceptores (fetch, XMLHttpRequest, wrapper functions.invoke)
- ✅ Ter forçado a URL correta no código
- ✅ Ter limpo cache do navegador várias vezes
- ✅ Ter feito rebuild completo e redeploy

---

## 🔴 PROBLEMA ATUAL

**URL CORRETA (nova):**
- `https://zunuqaidxffuhwmvcwul.supabase.co`
- Projeto ID: `zunuqaidxffuhwmvcwul`

**URL ANTIGA (ainda sendo usada):**
- `https://qbtqjrcfseqcfmcqlngr.supabase.co` (ou `gbtqjrcfseqcfmcqlngr`)
- Projeto ID: `qbtqjrcfseqcfmcqlngr` (ou `gbtqjrcfseqcfmcqlngr`)

**Erro no Console:**
```
POST https://qbtqjrcfseqcfmcqlngr.supabase.co/functions/v1/criar-instancia-wuzapi-afiliado
500 (Internal Server Error)
```

---

## ✅ O QUE JÁ FOI FEITO

### 1. Variáveis de Ambiente no Vercel
- ✅ `VITE_SUPABASE_URL` = `https://zunuqaidxffuhwmvcwul.supabase.co`
- ✅ `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bnVxYWlkeGZmdWh3bXZjd3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjQ2NjgsImV4cCI6MjA4NDQwMDY2OH0.PGDZSDZ1fc01cs8HHulK1HSSv2UHl2sHuanCwIow6L4`
- ✅ Variáveis atualizadas e redeploy feito

### 2. Interceptores Implementados

#### A. `index.html` (executa ANTES de tudo)
```javascript
// Intercepta fetch e XMLHttpRequest ANTES do React carregar
const CORRECT_SUPABASE_URL = 'https://zunuqaidxffuhwmvcwul.supabase.co';
const OLD_URLS = ['qbtqjrcfseqcfmcqlngr', 'gbtqjrcfseqcfmcqlngr', 'jibpvpqgplmahjhswiza'];

// Intercepta window.fetch
// Intercepta XMLHttpRequest
// Tenta corrigir window.supabase.supabaseUrl se existir
```

#### B. `src/main.tsx` (executa no início do React)
```typescript
// Mesmo interceptor de fetch e XHR, mas no contexto React
```

#### C. `src/integrations/supabase/client.ts` (cliente Supabase)
```typescript
// 1. Força URL correta na criação do cliente
const FINAL_SUPABASE_URL = 'https://zunuqaidxffuhwmvcwul.supabase.co';
const FINAL_SUPABASE_KEY = 'sb_publishable_BT7lsfrAYrPII7bsH_I6WA_zmDkhorc';

// 2. Intercepta fetch e XMLHttpRequest novamente
// 3. Tenta sobrescrever supabase.supabaseUrl diretamente
// 4. WRAPPER CRÍTICO: Sobrescreve supabase.functions.invoke
const backupClient = createClient(FINAL_SUPABASE_URL, FINAL_SUPABASE_KEY, {...});
supabase.functions.invoke = async function(functionName, options) {
  // Força URL correta no cliente original
  // Atualiza sessão no backupClient
  // SEMPRE usa backupClient.functions.invoke
  return backupClient.functions.invoke(functionName, options);
};
```

### 3. Arquivos de Configuração

#### `.env` local
```env
VITE_SUPABASE_PROJECT_ID="zunuqaidxffuhwmvcwul"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_BT7lsfrAYrPII7bsH_I6WA_zmDkhorc"
VITE_SUPABASE_URL="https://zunuqaidxffuhwmvcwul.supabase.co"
```

#### `supabase/config.toml`
```toml
project_id = "zunuqaidxffuhwmvcwul"  # ✅ CORRIGIDO
```

### 4. Edge Function `criar-instancia-wuzapi-afiliado`
```typescript
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 
                    Deno.env.get('PROJECT_URL') || 
                    Deno.env.get('URL_DO_PROJETO') || 
                    'https://zunuqaidxffuhwmvcwul.supabase.co'  // Fallback hardcoded
```

---

## 🔍 ONDE A URL ANTIGA AINDA APARECE

Busca no código encontrou referências antigas em:
1. `supabase/config.toml` - `project_id = "jibpvpqgplmahjhswiza"`
2. Várias migrations SQL com URLs hardcoded
3. Algumas Edge Functions com URLs hardcoded
4. Arquivos de documentação (não afetam runtime)

---

## 🤔 HIPÓTESES DO PROBLEMA

1. **Service Worker persistente** - Mas já tentamos limpar
2. **Cache do Vercel** - Mas já fizemos redeploy
3. **Biblioteca @supabase/supabase-js interna** - Pode estar usando URL cached internamente
4. **Build do Vite** - Pode estar injetando URL antiga no bundle
5. **CDN/Vercel Edge Cache** - Pode estar servindo versão antiga
6. **LocalStorage/SessionStorage** - Pode ter URL antiga salva
7. **Supabase client criado antes dos interceptores** - Race condition

---

## 🎯 PERGUNTAS PARA CLAUDE

1. **Por que os interceptores não estão funcionando?**
   - Os interceptores estão em 3 camadas (HTML, main.tsx, client.ts)
   - Mas a requisição ainda vai para URL antiga
   - O wrapper `functions.invoke` deveria forçar o uso do `backupClient`

2. **Onde mais a URL pode estar sendo definida?**
   - Verificamos variáveis de ambiente
   - Verificamos código fonte
   - Onde mais pode estar?

3. **O `supabase/config.toml` pode estar causando isso?**
   - O `project_id` antigo pode estar sendo usado em algum lugar?
   - Isso afeta o frontend ou só o CLI?

4. **Como forçar o Supabase client a usar URL correta?**
   - Já tentamos sobrescrever `supabaseUrl`
   - Já tentamos criar novo cliente
   - O que mais podemos fazer?

5. **Pode ser problema de build/bundle?**
   - O Vite pode estar compilando a URL antiga no bundle?
   - Como verificar o bundle gerado?

6. **Solução definitiva?**
   - Precisamos de uma solução que **GARANTA** que a URL correta seja usada
   - Mesmo que haja cache, variáveis erradas, etc.

---

## 📦 STACK TECNOLÓGICA

- **Frontend:** React 18 + Vite + TypeScript
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Deploy:** Vercel
- **Biblioteca Supabase:** `@supabase/supabase-js` (versão mais recente)
- **Navegador:** Chrome (testado)

---

## 🔧 CÓDIGO RELEVANTE

### Cliente Supabase (`src/integrations/supabase/client.ts`)
```typescript
const FINAL_SUPABASE_URL = 'https://zunuqaidxffuhwmvcwul.supabase.co';
const FINAL_SUPABASE_KEY = 'sb_publishable_BT7lsfrAYrPII7bsH_I6WA_zmDkhorc';

export const supabase = createClient<Database>(FINAL_SUPABASE_URL, FINAL_SUPABASE_KEY, {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
  global: { headers: { 'x-client-info': 'amzofertas-web' } }
});

// Wrapper functions.invoke
if (typeof window !== 'undefined' && supabase.functions) {
  const backupClient = createClient<Database>(FINAL_SUPABASE_URL, FINAL_SUPABASE_KEY, {...});
  
  supabase.functions.invoke = async function(functionName: string, options?: any) {
    console.log('📤 [FUNCTIONS.INVOKE] Chamando função:', functionName);
    console.log('📤 [FUNCTIONS.INVOKE] URL base do cliente atual:', supabase.supabaseUrl);
    
    // Força URL correta
    if (supabase.supabaseUrl !== FINAL_SUPABASE_URL) {
      (supabase as any).supabaseUrl = FINAL_SUPABASE_URL;
    }
    
    // Atualiza sessão no backupClient
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await backupClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });
    }
    
    // USA SEMPRE O BACKUP CLIENT
    return backupClient.functions.invoke(functionName, options);
  };
}
```

### Como é chamado (`src/components/AfiliadoWhatsAppConnection.tsx`)
```typescript
const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-afiliado', {
  body: { action: 'criar-instancia', nome, email, telefone }
});
```

---

## 🚨 URGÊNCIA

Este é um problema **BLOQUEADOR** - o site não funciona porque está tentando acessar um projeto Supabase que não existe mais. Precisamos de uma solução **DEFINITIVA** e **IMEDIATA**.

---

## 💡 O QUE PRECISAMOS

1. **Diagnóstico preciso** - Onde exatamente a URL antiga está sendo definida/usada?
2. **Solução garantida** - Como garantir que SEMPRE use a URL correta?
3. **Passos claros** - O que fazer agora para resolver?

---

**Por favor, Claude, analise este problema e forneça uma solução definitiva. Estamos em esgotamento mental tentando resolver isso há dias.**
