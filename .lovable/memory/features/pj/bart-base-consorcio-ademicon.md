---
name: BART - Base de Atendimento Consórcio Ademicon
description: BART (tenant Paulo Canarim) usa a mesma base de pré-atendimento de consórcio do Silvester; Paulo é gerente igual ao Marcelo
type: feature
---
BART = agente do tenant Paulo Canarim (`user_id d6159ef4-f0bd-4935-a335-c5e8964e4f17`), gerente Ademicon — mesmo papel do Marcelo Martins no tenant do Silvester.

Base de atendimento (gravada em `whatsapp_cloud_agent_config`: persona, tone, greeting, knowledge_base, handoff_rules):
- Postura consultiva não-invasiva (mesma regra do Silvester): nunca insistir em dado/documento, oferecer pré-atendimento UMA vez, respeitar recusa.
- Conteúdo de consórcio: o que é, modalidades (imóvel/veículo/serviços/pesados), contemplação (sorteio/lance/FGTS), taxa de administração, fundo de reserva, transferência de cota.
- Proibido: prometer contemplação, citar parcela/taxa exata sem o Paulo, tratar consórcio como investimento com rendimento.
- Handoff automático ao final do atendimento com resumo (nome, telefone, status, dados, documentos) para o Paulo.
- Grafia obrigatória: "Ademicon".

O playbook de pré-atendimento + handoff + dossiê (`silvester_dossies`, OCR de documentos) no `whatsapp-cloud-inbound-processor` é TENANT-AGNÓSTICO: usa `userId` e `resolveTenantOwner()`. Nomes de agente/dono são dinâmicos (`agent.agent_name`, `ownerFirstName`) — nada de "Silvester"/"Marcelo"/"Felício" hardcoded. Novo cliente do mesmo nicho = só configurar `owner_phone` + persona/knowledge_base, zero código.
