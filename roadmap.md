# Roadmap

- [x] Mapear publicação atual em produtos, vídeos e Jarvis
- [x] Definir publicação simultânea com confirmação e status por rede
- [x] Implementar botão único sem alterar fluxos individuais ou WhatsApp
- [x] Implementar comando “publica em todas” no Jarvis com confirmação obrigatória
- [x] Validar limites de legenda por rede, três pontos de entrada e respostas individuais
- [x] Explicar claramente que o TikTok foi enviado aos rascunhos para finalização no app

## Fase 1 — rede de proteção do Jarvis
- [ ] Extrair roteador de intenção para módulo testável
- [ ] Classificar mensagem atual antes do histórico, com precedência de nova intenção
- [ ] Corrigir colisão imagem/vídeo (Instagram/Facebook não bastam para edição)
- [ ] Validação final: intenção de vídeo só chama vídeo
- [ ] Nunca expor códigos internos (sem_imagem); perguntar quando ambíguo
- [ ] Matriz de intenção, incluindo erros de digitação e abreviações
- [ ] Publicar e avisar para teste com o comando que falhou
