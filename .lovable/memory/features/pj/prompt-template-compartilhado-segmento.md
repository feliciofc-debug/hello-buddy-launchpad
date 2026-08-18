---
name: Template de prompt compartilhado por segmento
description: Corpo do prompt do agente vive uma vez em agent_knowledge_segments.prompt_template; cada tenant guarda só variáveis (rede Ademicon)
type: feature
---
Prompt de agente de rede NÃO é copiado por cliente.

- Corpo único em `agent_knowledge_segments.prompt_template` (segmento `ademicon-consultor`). Ajuste de regra = 1 update, vale pra rede inteira.
- Variáveis por tenant em `whatsapp_cloud_agent_config`: `agent_name` (NOME_AGENTE), `nome_consultor`, `primeiro_nome`, `cargo`, `whatsapp_consultor`. Vínculo por `knowledge_segment_id`.
- Substituição em `renderSegmentPromptTemplate()` (`_shared/agent-soul.ts`): placeholders `{{NOME_AGENTE}}`, `{{NOME_CONSULTOR}}`, `{{PRIMEIRO_NOME}}`, `{{CARGO}}`, `{{WHATSAPP_CONSULTOR}}`.
- Quando há template: `PERSONALITY_CORE` (que pede respostas longas/estruturadas) fica FORA do system prompt; entram travas do segmento + tópicos + catálogo + regra de ouro + lembrete de formato (3 linhas / 350 chars / 1 pergunta).
- Sem template: comportamento antigo (persona/tom/saudação/base do tenant).
- Fail-safe mantido: `knowledge_segment_id` sem travas ativas → MODO SEGURO.
- Isolamento: template é compartilhado, dados/variáveis/catálogo são sempre `.eq('user_id', tenant)`.

Tenant Paulo Canarim (`d6159ef4-f0bd-4935-a335-c5e8964e4f17`): BART / Paulo Canarim / Paulo / gerente comercial / 5521997208854.
