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
