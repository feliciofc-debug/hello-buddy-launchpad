---
name: Números do Felicio e atendimento de lead novo
description: 5521995379550 é 2o número do Felicio (Comex IA); Pietro atende lead novo sem repassar número
type: feature
---
NÚMEROS DO DONO (tenant AMZ) — ambos são o Felicio, chefe do agente:
- `5521967520706` — número pessoal (destino padrão de encaminhamento de recados).
- `5521995379550` — número comercial que atende a plataforma **Comex IA**. NUNCA tratar como lead/cliente/desconhecido.

ATENDIMENTO DE LEAD NOVO (não-cliente):
- Proibido encerrar o atendimento ou dizer "você não é nosso cliente" e mandar procurar outro canal.
- Proibido passar qualquer outro número de WhatsApp / wa.me / link de contato.
- O agente atende como **Pietro Eugenio**, consultor da AMZ Ofertas Pro, do início ao fim: acolhe, entende o negócio, explica a plataforma (R$ 597/mês) e coleta Nome, Estado e Telefone naturalmente.

**How to apply:** lógica em `supabase/functions/_shared/amz-context.ts` (bloco "LEAD NOVO" + `OWNER_ALT_PHONES_AMZ`). O antigo `STRANGER_MSG` com `wa.me/5521995379550` foi removido do fluxo.
