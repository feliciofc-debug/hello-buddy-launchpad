# 🤖 Prompt para Kimi - Problema URL Supabase

## 📋 Contexto Completo

Copia e cola este prompt para o Kimi:

---

```
Preciso de ajuda urgente com um problema persistente de URL do Supabase em uma aplicação React/TypeScript.

CONTEXTO:
- Aplicação: React + TypeScript + Vite, deployada no Vercel
- Backend: Supabase (PostgreSQL + Edge Functions)
- Problema: A aplicação continua tentando usar uma URL antiga do Supabase mesmo após múltiplas tentativas de correção

URL ANTIGA (que precisa ser removida):
- https://qbtqjrcfseqcfmcqlngr.supabase.co
- https://gbtqjrcfseqcfmcqlngr.supabase.co
- https://jibpvpqgplmahjhswiza.supabase.co

URL CORRETA (que deve ser usada):
- https://zunuqaidxffuhwmvcwul.supabase.co

O QUE JÁ FOI FEITO:
1. ✅ Variável de ambiente VITE_SUPABASE_URL atualizada no Vercel
2. ✅ Código atualizado para forçar URL correta
3. ✅ Interceptors de fetch() e XMLHttpRequest instalados
4. ✅ Wrapper em supabase.functions.invoke() criado
5. ✅ Redeploy feito no Vercel múltiplas vezes
6. ✅ Cache do navegador limpo
7. ✅ Tabelas criadas no novo projeto Supabase

O PROBLEMA PERSISTE:
- No console do navegador, ainda aparece requisições para a URL antiga
- Erro 500 ao tentar criar instância via Edge Function
- O código tem interceptors, mas parece que não estão funcionando

ARQUIVOS RELEVANTES:
- src/integrations/supabase/client.ts (cliente Supabase)
- index.html (interceptors iniciais)
- src/main.tsx (interceptors no início da app)
- src/components/AfiliadoWhatsAppConnection.tsx (componente que chama a função)

PERGUNTA:
Por que os interceptors não estão funcionando? O que mais pode estar causando isso? 
Há alguma forma mais eficaz de forçar a URL correta?

Preciso de uma solução definitiva que funcione 100%.
```

---

## 🎯 Como Usar

1. Copie TODO o texto entre as linhas `---`
2. Cole no Kimi
3. Envie
4. Compartilhe a resposta do Kimi comigo

---

**Vamos ver o que o Kimi sugere!** 🚀
