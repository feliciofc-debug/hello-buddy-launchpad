# 🔒 GOVERNANÇA: SISTEMA DE ENVIO PROGRAMADO PJ

## ⚠️ ARQUIVOS PROTEGIDOS - NÃO ALTERAR SEM AUTORIZAÇÃO

### Edge Functions Críticas (PRODUÇÃO ATIVA)
| Arquivo | Função | Status |
|---------|--------|--------|
| `supabase/functions/executar-campanhas-agendadas/index.ts` | Executor principal de campanhas | ✅ FUNCIONANDO |
| `supabase/functions/send-wuzapi-message-pj/index.ts` | Envio de mensagens PJ | ✅ FUNCIONANDO |
| `supabase/functions/send-wuzapi-group-message-pj/index.ts` | Envio para grupos PJ | ✅ FUNCIONANDO |
| `supabase/functions/executar-envio-programado-pj/index.ts` | Executor de automação PJ | ✅ FUNCIONANDO |
| `supabase/functions/processar-fila-pj/index.ts` | Fila anti-bloqueio PJ | ✅ FUNCIONANDO |
| `supabase/functions/wuzapi-webhook-pj/index.ts` | Webhook assistente PJ | ✅ FUNCIONANDO |

### Regras de Roteamento (CRÍTICAS)
```
PJ (Pessoa Jurídica) → Funções com sufixo "-pj"
Afiliado → Funções com sufixo "-afiliado" ou sem sufixo
```

### Correção Aplicada (2025-02-05)
- **Problema**: `executar-campanhas-agendadas` chamava `send-wuzapi-message-afiliado`
- **Solução**: Alterado para `send-wuzapi-message-pj` (linha 275)
- **Resultado**: Envio programado para listas de transmissão PJ funcionando

## 🚫 PROIBIDO SEM AUTORIZAÇÃO

1. Alterar chamadas de função de `-pj` para `-afiliado` ou vice-versa
2. Modificar lógica de roteamento baseada em `user_id`
3. Alterar estrutura de payload das funções de envio
4. Remover validação de números (9º dígito)
5. Modificar busca de instância WuzAPI por porta

## ✅ FRASE DE CONFIRMAÇÃO OBRIGATÓRIA

Para qualquer alteração nos arquivos acima, o desenvolvedor DEVE incluir:

```
"CONFIRMO ALTERAÇÃO NO SISTEMA ENVIO PROGRAMADO PJ"
```

## 📊 Fluxo de Envio Programado PJ

```
campanhas_recorrentes (tabela)
    ↓
executar-campanhas-agendadas (pg_cron)
    ↓
send-wuzapi-message-pj (API WuzAPI Locaweb)
    ↓
wuzapi_instances (resolve IP:Porta)
    ↓
WhatsApp do cliente
```

## 🔍 Como Verificar se Está Funcionando

1. Agendar campanha para próximo minuto
2. Verificar logs: `supabase--edge-function-logs` com função `executar-campanhas-agendadas`
3. Confirmar que chama `send-wuzapi-message-pj` (não afiliado)
4. Mensagem deve chegar no WhatsApp

---
**Última atualização**: 2025-02-05
**Status**: ✅ SISTEMA ESTÁVEL - NÃO MEXER
