# Roadmap

- [x] Mapear publicação atual em produtos, vídeos e Jarvis
- [x] Definir publicação simultânea com confirmação e status por rede
- [x] Implementar botão único sem alterar fluxos individuais ou WhatsApp
- [x] Implementar comando “publica em todas” no Jarvis com confirmação obrigatória
- [x] Validar limites de legenda por rede, três pontos de entrada e respostas individuais
- [x] Explicar claramente que o TikTok foi enviado aos rascunhos para finalização no app

## Fase 1 — rede de proteção do Jarvis
- [x] Extrair roteador de intenção para módulo testável
- [x] Classificar mensagem atual antes do histórico, com precedência de nova intenção
- [x] Corrigir colisão imagem/vídeo (Instagram/Facebook não bastam para edição)
- [x] Validação final: intenção de vídeo só chama vídeo
- [x] Nunca expor códigos internos (sem_imagem); perguntar quando ambíguo
- [x] Matriz de intenção, incluindo erros de digitação e abreviações
- [x] Publicar e avisar para teste com o comando que falhou

## Texto nunca truncado (concluído)
- [x] Causa identificada: `cortarFrase`/`cortar` fatiavam no limite e fechavam com "…" (roteiro de vídeo, vídeo de produto, legenda de campanha).
- [x] Módulo único `_shared/texto-completo.ts` (corte em frase completa + `textoIncompleto`).
- [x] Texto nasce curto: limites como regra dura no prompt + uma reescrita automática quando estoura.
- [x] Aviso no roteiro do Jarvis antes de aprovar.
- [x] `publicar-todas-redes` bloqueia legenda incompleta (400).
- [x] Legenda de campanha WhatsApp cortada em frase completa.
- [x] Testes `_shared/texto-completo.test.ts` (8 passando com a matriz de intenção).

## Isolamento definitivo de identidade em vídeos
- [x] Corrigir estado residual após enviar vídeo de prospecção pela plataforma
- [x] Persistir a origem da identidade em rascunhos e jobs
- [x] Separar logos temporárias em namespace de prospecção
- [x] Bloquear logo incompatível antes de enfileirar e novamente antes de renderizar
- [x] Preservar a origem da identidade durante aprovação pelo Jarvis
- [x] Adicionar teste de regressão cliente A → marca oficial B

## Incidente — publicação de vídeo errado
- [x] Identificar a mídia publicada, horário, redes e comando de confirmação
- [x] Registrar vídeos recém-renderizados na biblioteca com vínculo ao job
- [x] Proibir seleção implícita da “última mídia” ao preparar publicação
- [x] Mostrar a mídia exata no resumo antes da confirmação
- [x] Gravar quem aprovou, quando aprovou e qual mídia foi aprovada
- [ ] Adicionar regressão: vídeo novo nunca pode publicar vídeo antigo
- [x] Publicar e validar os bloqueios sem disparar conteúdo real
- [x] Aprovação: texto integral por opção + bloqueio de segmento alheio

- [ ] Publicação por ID imutável (asset_id + tipo) em todos os caminhos
- [ ] ID curto visível na geração e na confirmação (comparável pelo dono)
- [ ] Jarvis com publicação desativada até validação concluída
- [ ] Resposta ao dono: causa do incidente + verificação de impacto em clientes

## Cota configurável de vídeos Motion
- [x] Remover cota fixa de 5 vídeos do código
- [x] Deixar administradores ilimitados
- [x] Configurar limite por plano e exceção por conta
- [x] Ignorar falhas e cancelamentos na cota
- [x] Avisar uso e saldo antes do limite
- [x] Criar área “Cotas de vídeo” no painel administrativo
- [x] Validar regras e interface sem iniciar renderizações reais

## Incidente — contexto e intenção no WhatsApp real
- [ ] Rastrear por que o filtro de nicho não bloqueou a copy odontológica no caminho real
- [ ] Cobrir no teste o mesmo caminho executado pelo processador do WhatsApp
- [ ] Classificar “sim” após confirmação como publicação, nunca como nova geração
- [ ] Validar ponta a ponta com o histórico real sem publicar conteúdo adicional
- [x] Corrigir caminho real do WhatsApp: “sim” após prévia publica exatamente o asset aprovado por ID
- [x] Integrar filtro de nicho no caminho real do processador
- [ ] Validar ponta a ponta no WhatsApp sem publicar mídia adicional
