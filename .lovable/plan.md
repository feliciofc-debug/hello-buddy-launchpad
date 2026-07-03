# Plano: Padronizar Checkout de Contratação

## Objetivo
Fazer com que o cliente que contrata pela primeira vez (via /cadastro → /planos) caia no mesmo checkout que já está comprovadamente funcionando em `/pagar/:subscriptionId` — o mesmo link que recebeu pagamento com sucesso.

## Situação atual
- **Funciona 100%:** `/pagar/:subscriptionId` → usa `PaymentFormDirectPublico` (via RPC `get_billing_pagamento_publico`).
- **Fluxo de contratação (novo cliente):** `/cadastro` cria conta → redireciona `/planos` → renderiza `PaymentFormDirect` embutido (fluxo diferente, mais frágil).

O usuário quer os dois **idênticos**.

## Estratégia (segura, mínima)
Em vez de reescrever o checkout de contratação, vamos **criar o billing_customer + billing_subscription logo após o signup** e redirecionar para o mesmo `/pagar/{subscriptionId}` já testado.

Assim reusamos 100% o fluxo que já funciona, sem tocar nos arquivos protegidos de pagamento.

## Passos

### 1. Nova Edge Function: `criar-cobranca-onboarding`
Recebe: `user_id`, `email`, `whatsapp`
Faz:
- Cria `billing_customers` (platform_login = user_id, email, phone)
- Cria `billing_subscriptions` (customer_id, amount=597, status='pending_payment', dia_vencimento, next_billing_date)
- Retorna `{ subscription_id }`

Usa `SERVICE_ROLE_KEY` (não expõe nada sensível).
**Não toca em nenhum arquivo protegido.**

### 2. Ajuste em `src/pages/Planos.tsx` (arquivo NÃO protegido no fluxo de exibição)
Após confirmar `user` autenticado:
- Chama `criar-cobranca-onboarding` com dados do user
- Redireciona `navigate('/pagar/' + subscription_id)`

Fallback: se der erro na criação, mantém o `PaymentFormDirect` atual (não quebra vendas).

### 3. Nada muda em:
- `PaymentFormDirect.tsx` ❌ não toco
- `PaymentFormDirectPublico.tsx` ❌ não toco  
- `PagarMensalidade.tsx` ❌ não toco
- `Cadastro.tsx` handleSubmit ❌ não toco (só o Planos.tsx muda)
- edge functions billing-* / criar-cobranca-* existentes ❌ não toco
- tabelas billing_* ❌ não altero schema

## Fluxo final do cliente
```
Site → /cadastro → cria conta → /planos
   → (auto) cria billing_customer + subscription pendente
   → redirect /pagar/{id}
   → MESMO checkout do link que já funciona ✅
```

## Verificação
1. Criar conta de teste
2. Confirmar redirect para `/pagar/{uuid}`
3. Confirmar que a tela é idêntica à do link `https://www.amzofertas.com.br/pagar/59ce87b5-...`
4. Verificar console/network sem erros

## Riscos
- **Baixo**: só adiciono 1 edge function nova + 1 chamada em Planos.tsx antes do render atual.
- Fallback preserva fluxo antigo caso a nova função falhe.
- Zero mudança em código de pagamento validado.

Confirma que posso executar?