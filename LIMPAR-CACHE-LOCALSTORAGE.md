# 🔍 Limpar Cache e LocalStorage

## ✅ Banco de Dados Está Limpo!

Você confirmou que não há instâncias no banco de dados. Isso significa que o problema está em outro lugar!

---

## 🔴 Possíveis Causas

### 1. **LocalStorage do Navegador**
O navegador pode ter dados antigos salvos localmente.

### 2. **Cache do Lovable**
A Lovable pode estar usando código/configuração antiga.

### 3. **Projeto Supabase Errado**
A Lovable pode estar conectada ao projeto Supabase antigo.

---

## ✅ Soluções

### Solução 1: Limpar LocalStorage

1. No navegador, pressione **F12** (abrir DevTools)
2. Vá na aba **"Application"** (ou "Aplicativo")
3. No menu lateral, clique em **"Local Storage"**
4. Clique no domínio: **`lovable.dev`** ou **`amzofertas.com.br`**
5. Você verá uma lista de chaves/valores
6. Procure por:
   - `supabase.auth.token`
   - `sb-*-auth-token`
   - Qualquer coisa relacionada a `wuzapi` ou `whatsapp`
7. **Delete todas essas chaves** (clique com botão direito → Delete)
8. Ou **delete tudo**: Clique com botão direito no domínio → "Clear"

### Solução 2: Limpar SessionStorage

1. Na mesma aba **"Application"**
2. Clique em **"Session Storage"**
3. Clique no domínio
4. **Delete tudo** (se houver algo)

### Solução 3: Limpar Cache do Navegador

1. Pressione **Ctrl + Shift + Delete**
2. Selecione:
   - ✅ **Imagens e arquivos em cache**
   - ✅ **Cookies e outros dados do site**
3. Período: **Todo o período**
4. Clique em **"Limpar dados"**

### Solução 4: Verificar Variáveis de Ambiente na Lovable

1. Na Lovable, vá em **Settings** ou **Environment Variables**
2. Verifique se `VITE_SUPABASE_URL` está correto:
   - Deve ser: `https://zunuqaidxffuhwmvcwul.supabase.co`
3. Se estiver errado, corrija e faça um novo deploy

### Solução 5: Modo Anônimo

1. Abra uma **janela anônima** (Ctrl + Shift + N)
2. Acesse a Lovable
3. Veja se o problema persiste (sem cache/localStorage)

---

## 🔍 Verificar no Console

1. Abra o Console (F12)
2. Digite e pressione Enter:

```javascript
// Ver localStorage
console.log('LocalStorage:', localStorage);

// Ver sessionStorage
console.log('SessionStorage:', sessionStorage);

// Limpar tudo (se necessário)
localStorage.clear();
sessionStorage.clear();
```

---

## 📋 Checklist

- [ ] Limpei LocalStorage (Application → Local Storage)
- [ ] Limpei SessionStorage (Application → Session Storage)
- [ ] Limpei cache do navegador (Ctrl + Shift + Delete)
- [ ] Verifiquei variáveis de ambiente na Lovable
- [ ] Testei em modo anônimo
- [ ] Recarreguei a página (Ctrl + Shift + R)

---

## 🎯 Depois de Limpar

1. Recarregue a página (Ctrl + Shift + R)
2. Tente criar uma nova instância
3. O sistema deve começar do zero

---

**Tente limpar o LocalStorage primeiro! Isso geralmente resolve!** 🚀
