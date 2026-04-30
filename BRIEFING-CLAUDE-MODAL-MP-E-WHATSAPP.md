# 📘 BRIEFING TÉCNICO PARA CLAUDE

**Projeto:** AMZ Ofertas Pro
**Stack:** React 18 + Vite + TypeScript + Tailwind + Lovable Cloud (Supabase)
**Autor do briefing:** Lovable (agente que está construindo o sistema)

Este documento explica em detalhes **dois fluxos críticos do sistema** para que possamos analisar em conjunto:

1. **Modal Pro do Mercado Pago** — usado para gerar e enviar cobranças aos clientes
2. **Sistema de envio de mensagens via WhatsApp** — fila anti-bloqueio e gateway

---

## 🟦 PARTE 1 — MODAL PRO DO MERCADO PAGO (COBRANÇAS)

### 1.1 Visão Geral

O sistema gera um **link público de pagamento** (`/pagar/:subscriptionId`) que pode ser enviado ao cliente final via WhatsApp/email. Esse link abre uma página com visual "Pro" (header escuro `#1a2332`, gradiente, badges de PIX/Cartão/Boleto) e, ao clicar em "Pagar com Mercado Pago", redireciona para o **Checkout Pro oficial do Mercado Pago** (página hospedada pelo MP, com PIX, cartão e boleto integrados).

### 1.2 Arquitetura (3 camadas)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PAINEL INTERNO (admin/operador da AMZ)                   │
│    src/pages/pay/PayAdmin.tsx                               │
│    ↓ cria customer + subscription pendente                  │
│    ↓ gera link: https://amzofertas.com.br/pagar/<sub_id>   │
│    ↓ envia o link pro cliente por WhatsApp                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. PÁGINA PÚBLICA DE PAGAMENTO (cliente final)              │
│    Rota: /pagar/:subscriptionId                             │
│    Arquivo: src/pages/PagarMensalidade.tsx                  │
│    ↓ Carrega dados de billing_subscriptions + customer      │
│    ↓ Renderiza modal "Pro" com valor, vencimento, métodos   │
│    ↓ Botão "Pagar" chama edge function pública              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. EDGE FUNCTION → MERCADO PAGO                             │
│    supabase/functions/criar-cobranca-mercadopago-publico    │
│    ↓ Valida subscription_id                                 │
│    ↓ Cria Preference no MP via REST API                     │
│    ↓ Retorna init_point (URL do Checkout Pro do MP)         │
│    ↓ Frontend redireciona via window.location.href          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. WEBHOOK DE CONFIRMAÇÃO                                   │
│    supabase/functions/billing-webhook                       │
│    ↓ MP notifica pagamento aprovado/recusado                │
│    ↓ Atualiza billing_subscriptions.status = 'paid'         │
│    ↓ Atualiza next_billing_date (+1 mês)                    │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Tabelas Envolvidas

```sql
billing_customers (
  id uuid PK,
  name text,
  email text UNIQUE,
  phone text,
  payment_link text  -- último link gerado
)

billing_subscriptions (
  id uuid PK,
  customer_id uuid FK → billing_customers,
  amount numeric,           -- ex: 597.00
  status text,              -- 'pending_payment' | 'paid' | 'overdue'
  next_billing_date date,
  dia_vencimento int,       -- 1-31, validado por trigger
  created_at timestamptz
)
```

Trigger `validar_dia_vencimento_billing` impede valores inválidos.

### 1.4 Fluxo Detalhado do Modal Público (`PagarMensalidade.tsx`)

**Carregamento (useEffect):**
```ts
const { data: sub } = await supabase
  .from('billing_subscriptions')
  .select('amount, next_billing_date, customer_id')
  .eq('id', subscriptionId)
  .maybeSingle();

const { data: cust } = await supabase
  .from('billing_customers')
  .select('name, email')
  .eq('id', sub.customer_id)
  .maybeSingle();
```

> ⚠️ **Importante:** essa página é **pública** (o cliente final não tem login). As policies de RLS em `billing_subscriptions` e `billing_customers` permitem `SELECT` anônimo apenas dos campos necessários. Estamos avaliando trocar por uma edge function `get-cobranca-publica` para não expor a tabela inteira.

**Clique em "Pagar":**
```ts
const { data } = await supabase.functions.invoke('criar-cobranca-mercadopago-publico', {
  body: { subscription_id: subscriptionId },
});
window.location.href = data.payment_link; // → init_point do MP
```

### 1.5 Edge Function `criar-cobranca-mercadopago-publico`

Pontos-chave:

- **Pública** (sem token de admin) — chamada pelo cliente final
- Valida que `subscription_id` existe
- Monta o objeto `preference` com:
  - `items[]` → título "Mensalidade AMZ Ofertas Pro - venc. YYYY-MM-DD"
  - `payer` → email/nome do customer
  - `external_reference` → `subscription_id` (chave para reconciliar no webhook)
  - `notification_url` → `${SUPABASE_URL}/functions/v1/billing-webhook`
  - `back_urls` → `success/failure/pending` voltando para `/pagar/:id?status=...`
  - `auto_return: "approved"` — volta automático após aprovação
  - `payment_methods.installments: 1` (cobrança avulsa, à vista)
- POST para `https://api.mercadopago.com/checkout/preferences` com `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
- Retorna `init_point` (URL do Checkout Pro do MP)

**Secret usada:** `MERCADOPAGO_ACCESS_TOKEN` (token de produção, armazenado no Supabase Secrets)

### 1.6 Versão Interna `criar-cobranca-mercadopago` (admin)

Mesma lógica, mas:
- Protegida por `x-billing-token` (header com hash diário derivado de `BILLING_ADMIN_PASSWORD`)
- Recebe `customer_id` (não `subscription_id`) e busca a última subscription
- Permite até 12x parcelado (`installments: 12`)
- Salva `payment_link` no customer

### 1.7 Componentes Visuais Reutilizáveis

- `src/components/CheckoutProMP.tsx` → modal embutido no site (planos)
- `src/pages/PagarMensalidade.tsx` → página pública de cobrança (cliente)
- `src/components/TestarPietroCobrancaModal.tsx` → testar fluxo da IA

Ambos seguem o **design system AMZ**:
- Cor primária: `#1a2332` (Dark Blue)
- CTA: `gradient orange-500 → orange-600`
- Badges PIX (verde "Aprovação imediata"), Cartão, Boleto

### 1.8 Pontos a Discutir com Claude

1. **Segurança:** atualmente a página `/pagar/:id` faz query direta nas tabelas. Vale isolar via edge function para esconder colunas sensíveis?
2. **Reconciliação:** o webhook depende 100% do `external_reference`. Precisamos de retry/dead-letter se o MP enviar webhook antes da subscription estar persistida?
3. **Recorrência:** hoje cada mês é uma `preference` nova (cobrança avulsa). Faz sentido migrar para **assinatura recorrente do MP** (`preapproval`) para débito automático no cartão?

---

## 🟩 PARTE 2 — SISTEMA DE ENVIO DE MENSAGENS WHATSAPP

### 2.1 Visão Geral

WhatsApp **NÃO é enviado direto** — toda mensagem passa por uma **fila anti-bloqueio** (`fila_atendimento_pj`) com delays randomizados, simulação de digitação, e fallback automático entre instâncias do gateway.

### 2.2 Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│ ORIGEM (frontend / IA / cron de campanhas)                   │
│  ↓                                                            │
│  Chama RPC: inserir_campanha_fila(user_id, contatos[], msg)  │
│  ↓                                                            │
│  ┌────────────────────────────────────────────┐              │
│  │ TABELA: fila_atendimento_pj                │              │
│  │  - status: pendente|processando|enviado|erro│             │
│  │  - scheduled_at, tentativas, prioridade     │             │
│  └────────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ pg_cron (a cada 1 min) → dispara via pg_net                  │
│  ↓                                                            │
│  Edge Function: processar-fila-pj                            │
│   1. Busca até 5 itens pendentes                             │
│   2. Para cada item:                                          │
│      a. Resolve instância conectada (buscarInstanciaConectada)│
│      b. Envia "digitando..." (POST /chat/presence)           │
│      c. Aguarda 1.5–4s (simula digitação humana)             │
│      d. Aguarda delay aleatório 3–8s                         │
│      e. POST /chat/send/text ou /chat/send/image             │
│      f. Atualiza status (enviado | erro com retry)           │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ GATEWAY (Baileys local rodando em servidor Locaweb)          │
│  URL: https://wuzapi.amzofertas.com.br (porta variável)      │
│  Cada instância = 1 número WhatsApp = 1 porta + 1 token      │
│  Tabela: wuzapi_instances                                     │
│   (port, wuzapi_token, assigned_to_user, is_connected)       │
└──────────────────────────────────────────────────────────────┘
                            ↓
                  📱 WhatsApp do cliente
```

### 2.3 Por que Fila? (Anti-ban)

WhatsApp baniria nosso número se enviássemos 100 mensagens em 1s. Por isso:

- **Delay 3–8s** entre cada mensagem (randomizado)
- **Status "digitando"** visível pro destinatário (humaniza)
- **Tempo de digitação** proporcional ao tamanho da mensagem (20ms/char, máx 8s)
- **Sequencial** por instância (1 mensagem por vez por número)
- **Retry com backoff** (até 3 tentativas, prioridade aumenta)

### 2.4 RPC `inserir_campanha_fila` (única porta de entrada)

**Regra de ouro do projeto:** mensagens **NUNCA** são inseridas direto na fila por código — sempre via RPC. Isso garante:
- Validação de `user_id` vs `auth.uid()` (RLS-like)
- Normalização de telefone (regex `\D`)
- Substituição de `{{nome}}` na mensagem
- Tratamento de grupos (`@g.us` mantém formato)

```sql
SELECT inserir_campanha_fila(
  p_user_id := 'uuid-do-usuario',
  p_contatos := '[{"phone":"5521967520706","name":"João","mensagem":"Oi {{nome}}"}]'::jsonb,
  p_mensagem := 'fallback se contato não tiver msg',
  p_imagem_url := 'https://...',
  p_lead_source := 'campanha_produtos',
  p_campanha_id := 'uuid-campanha'
);
```

### 2.5 Edge Function `processar-fila-pj` (worker)

**Configurações importantes (CONFIG):**
```ts
DELAY_MIN_MS: 3000        // 3s mínimo
DELAY_MAX_MS: 8000        // 8s máximo
TEMPO_TYPING_MIN_MS: 1500
TEMPO_TYPING_MAX_MS: 4000
TEMPO_TYPING_POR_CHAR_MS: 20
BATCH_SIZE: 5             // por execução de cron
MAX_TENTATIVAS: 3
```

**Resolução de instância (crítico — corrigido recentemente):**
```ts
async function buscarInstanciaConectada(supabase, userId, targetPort?) {
  // 1. Pega TODAS as instâncias do usuário, ordenadas por is_connected DESC
  // 2. Tenta a porta configurada SE estiver conectada
  // 3. Fallback: qualquer instância is_connected = true
  // 4. Último recurso: porta configurada (mesmo offline)
}
```

> **Bug recente resolvido:** uma porta configurada (8083) estava offline, mas o sistema insistia nela. Agora se a configurada está down, ele migra automaticamente para qualquer outra porta conectada do mesmo `user_id`.

### 2.6 Tipos de Mensagem Suportados

| Tipo    | Endpoint Baileys           | Notas                                |
|---------|----------------------------|--------------------------------------|
| Texto   | `POST /chat/send/text`     | `{ Phone, Body }`                    |
| Imagem  | `POST /chat/send/image`    | `{ Phone, Image (URL), Caption }`    |
| Áudio   | `POST /chat/send/audio`    | `{ Phone, Audio (base64 mp3) }` — TTS|
| Grupo   | mesmo endpoint             | `Phone = "5521xxx@g.us"`, sem typing |

Áudio/grupo **pulam** a etapa de "digitando" (não faz sentido em grupo, e áudio tem indicador próprio).

### 2.7 Webhook de Inbound (`wuzapi-webhook-pj`)

Mensagens recebidas no WhatsApp viram POST nesse webhook:
- Identifica usuário pela porta da instância
- Roteia para IA (Pietro/Sophia) via `lovable-ai-gateway`
- Resposta da IA volta pra fila (via mesma RPC)

**Anti-loop:** cooldown de 30s entre mensagens do mesmo número, pausa se detectar bot-to-bot.

### 2.8 Tabelas Envolvidas

```sql
fila_atendimento_pj (
  id uuid, user_id uuid, lead_phone text, lead_name text,
  mensagem text, imagem_url text, audio_base64 text, tipo_mensagem text,
  status text, scheduled_at timestamptz, tentativas int, prioridade int,
  campanha_id uuid, lead_source text, metadata jsonb,
  sent_at timestamptz, erro text
)

wuzapi_instances (
  id uuid, port int, wuzapi_url text, wuzapi_token text,
  assigned_to_user uuid, is_connected boolean,
  connected_at timestamptz, updated_at timestamptz
)

pj_clientes_config (
  user_id uuid, wuzapi_token text,
  limite_envios int, envios_utilizados int, envios_mes_atual int,
  mes_referencia text  -- 'YYYY-MM' para reset mensal
)
```

### 2.9 pg_cron + pg_net (agendamento)

Job rodando a cada 1 minuto:
```sql
SELECT cron.schedule('processar-fila-pj', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/processar-fila-pj',
    headers := jsonb_build_object('Authorization', 'Bearer ...', 'Content-Type', 'application/json'),
    body := jsonb_build_object('batchSize', 5)
  );
$$);
```

Campanhas agendadas usam um cron paralelo (`process_scheduled_campaigns`) que dispara `execute-campaign` que por sua vez chama a RPC `inserir_campanha_fila`.

### 2.10 Pontos a Discutir com Claude

1. **Multi-instância:** hoje 1 user = N instâncias com fallback. Para escalar 100+ clientes precisaríamos de pool dinâmico ou continuar 1:1?
2. **Rate limit por número:** o `BATCH_SIZE: 5` é global. Vale por-instância para não estourar 1 número específico?
3. **Observabilidade:** temos logs no console da edge function, mas falta dashboard agregado de "taxa de entrega/erro por instância". Faz sentido criar?
4. **WuzAPI vs Baileys puro:** estamos no Baileys local (.exe Windows). Migrar para Cloud API oficial do WhatsApp para os clientes que pagam mais (eliminar risco de ban)?

---

## 🔑 SECRETS RELEVANTES (apenas nomes)

| Secret                       | Uso                                          |
|------------------------------|----------------------------------------------|
| `MERCADOPAGO_ACCESS_TOKEN`   | Autorização Bearer no MP                     |
| `BILLING_ADMIN_PASSWORD`     | Token diário sha256 do admin de cobrança     |
| `APP_URL`                    | Base URL para `back_urls` (https://amzofertas.com.br) |
| `WUZAPI_URL`                 | Gateway Baileys (https://wuzapi.amzofertas.com.br) |
| `WUZAPI_TOKEN`               | Token padrão da instância principal          |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Acesso server-side nas edge functions |
| `LOVABLE_API_KEY`            | AI Gateway (Pietro/Sophia)                   |
| `GEMINI_API_KEY`             | Backup direto pro Google                     |
| `ELEVENLABS_API_KEY`         | TTS para áudio                               |

---

## 📂 ARQUIVOS-CHAVE PARA REVISÃO

**Cobrança MP:**
- `src/pages/PagarMensalidade.tsx` (página pública)
- `src/components/CheckoutProMP.tsx` (modal interno)
- `supabase/functions/criar-cobranca-mercadopago-publico/index.ts`
- `supabase/functions/criar-cobranca-mercadopago/index.ts` (admin)
- `supabase/functions/billing-webhook/index.ts`
- `supabase/functions/pietro-criar-cobranca/index.ts` (IA gera link)

**WhatsApp:**
- `supabase/functions/processar-fila-pj/index.ts` (worker)
- `supabase/functions/send-wuzapi-message-pj/index.ts` (envio direto)
- `supabase/functions/wuzapi-webhook-pj/index.ts` (inbound)
- `supabase/functions/executar-campanhas-agendadas/index.ts`
- RPC `inserir_campanha_fila` (no Postgres)

---

**Pronto para discussão.** Posso aprofundar qualquer ponto: schemas completos, exemplos de payload reais (anonimizados), logs do gateway, ou diagramas de sequência específicos.
