# ✅ Função Criada! Agora Vamos Verificar

## 🎯 Status

✅ Função `criar-instancia-wuzapi-afiliado` criada!  
✅ URL: `https://zunuqaidxffuhwmvcwul.supabase.co/functions/v1/criar-instancia-wuzapi-afiliado`  
✅ 1 deployment realizado

---

## ⚠️ IMPORTANTE: Desativar JWT Legacy

Vejo que a opção **"Verificar JWT com segredo legado"** está **ATIVADA** (verde).

**Isso precisa ser DESATIVADO** porque:
- O código da função já tem autenticação própria
- Ela verifica o token no header `Authorization`
- A recomendação do Supabase é desativar quando há lógica de autorização no código

### Como Desativar:

1. Na página de "Detalhes" da função
2. Procure por **"Verificar JWT com segredo legado"**
3. **Desative o toggle** (mude de verde para cinza)
4. Clique em **"Salvar alterações"**

---

## ✅ Verificar o Código

1. Clique na aba **"Código"** (no topo da página)
2. Verifique se o código foi colado corretamente
3. Deve começar com: `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'`

---

## 🚀 Testar a Função

Depois de desativar o JWT legacy:

1. Acesse: https://amzofertas.com.br/afiliado/conectar-celular
2. Faça login
3. Tente criar uma instância
4. Veja se funciona!

---

## 📋 Checklist Final

- [x] Função criada
- [ ] Verificar se código foi colado corretamente (aba "Código")
- [ ] Desativar "Verificar JWT com segredo legado"
- [ ] Salvar alterações
- [ ] Testar no site

---

**Desative o JWT legacy e me avise!** 😊
