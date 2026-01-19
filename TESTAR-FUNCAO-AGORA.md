# ✅ Função Deployada! Agora Vamos Testar

## 🎯 Status Atual

✅ Função `criar-instancia-wuzapi-afiliado` criada  
✅ Código atualizado e deployado  
✅ Secrets configurados (`URL_DO_PROJETO` e `CHAVE_FUNÇÃO_DE_SERVIÇO`)  
⏳ Falta: Desativar JWT legacy (se ainda não fez) e testar

---

## ⚠️ IMPORTANTE: Desativar JWT Legacy

Antes de testar, certifique-se de que o JWT legacy está DESATIVADO:

1. Na página da função, clique na aba **"Detalhes"**
2. Procure por **"Verificar JWT com segredo legado"**
3. **Desative o toggle** (deve estar cinza, não verde)
4. Se estiver verde, desative e clique em **"Salvar alterações"**

---

## 🚀 Testar a Função

### 1. Acessar o Site

1. Abra: **https://amzofertas.com.br/afiliado/conectar-celular**
2. Faça login na sua conta

### 2. Testar Criar Instância

1. Procure por um botão **"Criar Instância"** ou similar
2. Clique nele
3. Aguarde a resposta

### 3. Verificar se Funcionou

**Se funcionar:**
- ✅ Você verá uma mensagem de sucesso
- ✅ A instância será criada

**Se der erro:**
- ❌ Abra o console do navegador (F12)
- ❌ Veja qual erro aparece
- ❌ Me envie o erro completo

---

## 🔍 Verificar Logs da Função

Se quiser ver os logs da função:

1. No Supabase Dashboard, vá na função `criar-instancia-wuzapi-afiliado`
2. Clique na aba **"Registros"** (Logs)
3. Veja se há erros ou mensagens

---

## 📋 Checklist Final

- [x] Função criada
- [x] Código deployado
- [x] Secrets configurados
- [ ] JWT legacy desativado (verificar)
- [ ] Testar no site
- [ ] Verificar se funcionou

---

## 🆘 Se Der Erro

**Erro 401 (Unauthorized):**
- Verifique se desativou o JWT legacy
- Verifique se está logado no site

**Erro 404 (Not Found):**
- Verifique se a URL da função está correta
- Verifique se o deploy foi concluído

**Erro 500 (Internal Server Error):**
- Veja os logs da função (aba "Registros")
- Verifique se os secrets estão configurados corretamente

---

**Vamos testar!** Me avise o que aconteceu! 🚀
