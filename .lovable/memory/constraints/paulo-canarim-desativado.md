---
name: Paulo Canarim (BART) desativado
description: Tenant Paulo Canarim/Ademicon foi encerrado — agente BART e acesso à plataforma desligados, não reativar
type: constraint
---
O tenant Paulo Canarim (`user_id d6159ef4-f0bd-4935-a335-c5e8964e4f17`, agente **BART**, nicho consórcio Ademicon) foi ENCERRADO em 14/09/2026 por decisão do Felício.

Desligado:
- `whatsapp_cloud_agent_config.is_active = false` (agente BART fora do ar)
- `profiles.acesso_bloqueado = true` (sem acesso à plataforma)
- autopilot, campanhas PJ, agendamentos sociais e programações: inativos
- `user_planos.status = 'cancelado'`, fila de posts cancelada

**Why:** cliente não continua. Não reativar agente, plano ou automações desse tenant sem ordem explícita do Felício. As memórias de BART/Ademicon ficam apenas como referência histórica de playbook.
