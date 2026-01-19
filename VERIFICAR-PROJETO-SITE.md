# 🔍 Verificar Qual Projeto o Site Está Usando

## 🎯 Método Mais Rápido

### 1. Abrir o Site

1. Abra o navegador
2. Vá para: **https://amzofertas.com.br**
3. Faça login (se necessário)

### 2. Abrir o Console do Navegador

1. Pressione **F12** (ou clique com botão direito → "Inspecionar")
2. Vá na aba **"Console"** (no topo)

### 3. Procurar a URL do Supabase

No console, você verá mensagens como:

```
✅ [SUPABASE] Configurado: https://XXXXX.supabase.co
```

O **XXXXX** é o ID do projeto!

---

## 📸 O Que Você Deve Ver

Você deve ver algo assim no console:

```
🔧 [SUPABASE] Inicializando com URL forçada: https://jibpvpqgplmahjhswiza.supabase.co
✅ [SUPABASE] Configurado: https://jibpvpqgplmahjhswiza.supabase.co
```

**Copie o ID que aparece** (no exemplo acima seria: `jibpvpqgplmahjhswiza`)

---

## 🔄 Se Não Aparecer no Console

### Método Alternativo: Ver nas Requisições

1. No console (F12), vá na aba **"Network"** (Rede)
2. Recarregue a página (F5)
3. Na barra de busca, digite: `supabase`
4. Clique em qualquer requisição
5. Veja a URL completa - ela mostrará o ID do projeto

---

## ✅ Depois de Encontrar

**Me envie o ID do projeto** e eu te ajudo a acessá-lo no Supabase Dashboard!

---

**Exemplo:** Se você ver `https://abc123xyz.supabase.co`, o ID é `abc123xyz`
