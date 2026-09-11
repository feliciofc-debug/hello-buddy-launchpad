# Publicação única em todas as redes

## Objetivo
Criar uma ação única para publicar produtos e vídeos em Instagram, Facebook, TikTok e LinkedIn, preservando os botões individuais e mantendo o WhatsApp completamente fora desse fluxo.

## Implementação

### 1. Serviço compartilhado de publicação
- Centralizar a preparação e o envio por plataforma em uma função de backend autenticada e multi-tenant.
- Verificar antes do envio quais contas estão conectadas para o usuário atual.
- Publicar em paralelo nas redes conectadas e devolver um resultado separado por rede: publicado, enviado como rascunho, não conectado ou falhou com motivo.
- Aplicar limites de legenda por plataforma e selecionar automaticamente o formato compatível:
  - vídeo: Reels no Instagram/Facebook, rascunho no TikTok e vídeo no LinkedIn;
  - produto com imagem: feed/carrossel no Instagram/Facebook, imagem no LinkedIn e TikTok somente quando o formato for aceito.
- TikTok continuará obrigatoriamente em modo rascunho enquanto o Direct Post não estiver auditado.
- Não chamar nenhuma função de campanha ou envio de WhatsApp.

### 2. Janela única de confirmação
- Evoluir a publicação simultânea existente para mostrar:
  - redes conectadas e selecionadas;
  - redes desconectadas com ação para conectar;
  - formato destinado a cada rede;
  - legenda editável antes da confirmação.
- Exibir progresso e resultado individual em tempo real, sem esconder sucessos quando outra rede falhar.
- Destacar o botão **Publicar em todas as redes** acima dos botões individuais.

### 3. Produtos e vídeos
- Adicionar o botão aos cards de produto.
- Adicionar o mesmo botão aos vídeos enviados e aos vídeos gerados.
- Reutilizar o mesmo modal e a mesma lógica, variando apenas mídia, legenda inicial e formato.
- Manter todos os botões atuais de publicação individual sem alterar seus fluxos.

### 4. Jarvis pelo WhatsApp
- Reconhecer comandos como “publica em todas” no contexto de uma mídia/produto já aprovado.
- Encaminhar somente para Instagram, Facebook, TikTok e LinkedIn.
- Responder com uma linha por rede, por exemplo: publicado, rascunho, não conectado ou falha específica.
- Garantir explicitamente que esse comando nunca crie campanha nem agendamento de WhatsApp.

### 5. Validação e liberação
- Validar publicação parcial, rede desconectada, erro isolado e TikTok em rascunho.
- Conferir os três pontos de entrada em desktop e celular.
- Publicar as funções atualizadas após a validação.

## Observações técnicas
- A execução será concorrente com `Promise.allSettled`, evitando que uma falha interrompa as demais redes.
- Consultas de conexão serão sempre isoladas por `user_id`.
- Erros das APIs serão preservados e traduzidos para mensagens claras.
- Esta entrega não exige atualização do gerador Remotion na VPS; envolve a interface, o Jarvis e funções do backend.
