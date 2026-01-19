# ✅ Progresso! Erro 500 - Verificar Logs

## 🎉 Evolução!

- ❌ Antes: Erro 401 (não autorizado) - JWT bloqueando
- ✅ Agora: Erro 500 (erro interno) - Função está sendo chamada!

**Isso significa que o JWT legacy foi desativado com sucesso!** 🎉

---

## 🔍 Agora Precisamos Ver os Logs

O erro 500 significa que há um problema dentro da função. Vamos ver os logs:

### Como Ver os Logs:

1. No Supabase Dashboard, vá na função `criar-instancia-wuzapi-afiliado`
2. Clique na aba **"Registros"** (Logs)
3. Você verá os erros que estão acontecendo
4. **Me envie o erro completo** que aparecer lá

---

## 🔍 Possíveis Causas do Erro 500

1. **Secrets não encontrados:**
   - `URL_DO_PROJETO` ou `CHAVE_FUNÇÃO_DE_SERVIÇO` não estão configurados

2. **Erro ao acessar banco de dados:**
   - Tabelas não existem
   - Permissões incorretas

3. **Erro ao chamar Wuzapi:**
   - URL do Wuzapi incorreta
   - Token inválido

---

## 📋 O Que Fazer Agora

1. ✅ JWT legacy desativado (já fizemos)
2. ⏳ Ver logs da função (aba "Registros")
3. ⏳ Me enviar o erro completo
4. ⏳ Corrigir o problema

---

**Vamos ver os logs!** Me envie o que aparecer na aba "Registros"! 🚀
