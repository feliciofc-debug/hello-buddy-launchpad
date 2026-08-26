# Plano: Agente Dr. Bruno — Agenda + Modo Técnico Isolado

## Objetivo
Criar o agente WhatsApp do Dr. Bruno para atender pacientes (agenda e confirmação) e, exclusivamente no número do Dr. Bruno, operar em modo técnico-médico com a literatura da especialidade carregada na base de conhecimento do tenant.

## Fase 1 — Agente administrativo de agenda
1. Criar tenant/empresa para Dr. Bruno (ou reaproveitar cadastro existente).
2. Criar configuração do agente em `whatsapp_cloud_agent_config`:
   - Nome do agente, número do agente, número do dono (Dr. Bruno).
   - Saudação, tom profissional/cortês, confirmação de consultas.
3. Criar tabelas de agenda:
   - `drbruno_agenda` (horários disponíveis, bloqueados, recorrentes).
   - `drbruno_agendamentos` (paciente, telefone, data/hora, status, motivo, observações administrativas).
4. Implementar tools do agente:
   - `listar_horarios_disponiveis`
   - `criar_agendamento`
   - `confirmar_consulta`
   - `cancelar_reagendar`
   - `encaminhar_recado_ao_dono`
5. Implementar confirmação 24h antes via template (preparar fluxo; template real depende de aprovação Meta).
6. Criar tela simples `/drbruno/agenda` para o Dr. Bruno visualizar e gerenciar agendamentos.

## Fase 2 — Modo técnico isolado para o Dr. Bruno
1. Criar estrutura de conhecimento médico no tenant:
   - Inserir tópicos e regras em `agent_knowledge_topics` / `agent_knowledge_rules` / `agent_knowledge_segments` vinculados ao tenant do Dr. Bruno.
2. Atualizar o processador de inbound do WhatsApp para detectar o número do dono e carregar o contexto técnico completo.
3. Ajustar o system prompt do agente para:
   - No número do dono: responder como colega médico, citar literatura carregada, usar termos técnicos.
   - No número do paciente: nunca expor conteúdo técnico, manter respostas administrativas e de agenda.
4. Adicionar tool `buscar_literatura_medica` restrita ao modo dono.
5. Criar tela `/drbruno/conhecimento` para o Dr. Bruno acompanhar o que foi indexado.

## Dados necessários do usuário
- Nome do agente.
- Número WhatsApp do Dr. Bruno (dono).
- Número WhatsApp do agente (pode ser da clínica).
- Nome da clínica/consultório.
- Especialidade do Dr. Bruno.
- Grade de horários inicial (dias da semana + horários).
- Tempo padrão de cada consulta.
- Literatura médica em PDF/DOCX/TXT ou colada no chat.

## Entregáveis
- Agente WhatsApp ativo para pacientes do Dr. Bruno.
- Agendamento e confirmação sem orientação clínica no chat.
- Modo técnico exclusivo no número do Dr. Bruno com base de conhecimento médica.
- Telas de agenda e conhecimento no dashboard.

## Notas de segurança e compliance
- Nenhum histórico clínico, diagnóstico ou prescrição será armazenado no chat.
- A literatura médica fica isolada por tenant e só é exposta no contexto do dono.
- Confirmação 24h depende de template aprovado pela Meta; fluxo será preparado, mas aprovação é externa.
