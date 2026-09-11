# Publicação segura por ID imutável

## Situação atual

- A publicação automática e as filas permanecem desativadas: não há configurações ativas nem itens pendentes para publicar.
- O fluxo principal já exige um `midia_id`, mas ainda existem atalhos do Jarvis que procuram a “mídia recente” e depois não repassam esse ID. Esse é o ponto que permite a troca de vídeo por imagem ou por outro item.
- A confirmação hoje vincula principalmente a URL. URL não é uma identidade forte: a publicação precisa carregar o mesmo ID desde a geração até o envio à rede.

## O que será construído

### 1. Registro único de cada mídia

- Criar um registro de publicação para cada imagem ou vídeo gerado/enviado, com:
  - ID único imutável;
  - cliente proprietário;
  - tipo real (`imagem` ou `vídeo`);
  - origem e ID da geração;
  - endereço do arquivo, nome do arquivo e miniatura;
  - data de criação e estado de bloqueio.
- Vincular os vídeos animados ao registro usando o ID do trabalho de renderização, sem depender de data, posição na lista ou contexto da conversa.
- Manter os arquivos e o histórico existentes; nada será apagado.

### 2. Jarvis sem seleção implícita

- Remover todos os caminhos “última mídia” e “mídia recente” do fluxo de publicação.
- Ao concluir uma geração, o Jarvis guardará e devolverá o ID exato daquele item.
- Pedidos de publicação sem ID falharão de forma segura e pedirão ao usuário que selecione o item; nunca haverá fallback.
- A resposta de formato (`feed`, `story` ou `reels`) manterá o mesmo ID escolhido no passo anterior.
- Aprovação e revisão preservarão o ID original; mudar de mídia criará uma nova aprovação.

### 3. Prévia verificável antes da confirmação

Antes de aceitar “publicar”, o Jarvis e a tela mostrarão o mesmo registro:

- tipo da mídia;
- miniatura ou prévia do vídeo;
- nome do arquivo;
- ID curto visível;
- origem e horário da geração;
- redes, formato e texto integral.

A confirmação será vinculada a esse ID, ao responsável e ao horário. Se qualquer dado mudar depois da prévia, a aprovação será invalidada.

### 4. Validação rígida de tipo e propriedade

- A publicação buscará a mídia novamente pelo ID e pelo cliente no momento do envio.
- Comparará tipo aprovado, tipo registrado, coluna usada na fila e formato solicitado.
- Vídeo só poderá seguir como vídeo; imagem só poderá seguir como imagem.
- Item inexistente, bloqueado, pertencente a outro cliente, sem arquivo ou com tipo divergente falhará antes de chamar qualquer rede.
- A fila programada também exigirá esse vínculo; registros antigos sem ID permanecerão bloqueados.

### 5. Bloqueio central do Jarvis

- Manter a publicação pelo Jarvis desativada enquanto a migração e a validação não forem concluídas.
- Adicionar uma chave global de segurança consultada tanto na preparação quanto na confirmação/publicação.
- O bloqueio retornará uma mensagem clara, sem tentar outra mídia.
- Reativação somente após aprovação explícita do responsável e conclusão dos critérios abaixo.

### 6. Cobrir caminhos paralelos

Aplicar a mesma regra às saídas que hoje publicam diretamente ou por fila:

- postagem do Jarvis;
- vídeo animado aprovado;
- publicação em todas as redes;
- fila social programada;
- vídeos agendados;
- Facebook, Instagram, TikTok e LinkedIn.

Nenhum desses caminhos poderá receber apenas uma URL solta para publicar conteúdo gerado pelo Jarvis.

## Validação sem publicar conteúdo real

- Testar: vídeo A aprovado publica somente o ID do vídeo A.
- Testar: vídeo novo com imagem mais recente não troca de tipo nem de arquivo.
- Testar: ID inexistente, bloqueado ou de outro cliente falha sem fallback.
- Testar: confirmação de imagem não autoriza vídeo e confirmação de vídeo não autoriza imagem.
- Testar: troca de item após a prévia invalida a confirmação.
- Testar: resposta posterior de formato preserva o ID original.
- Testar isolamento cliente A → cliente B.
- Simular as chamadas às redes; nenhum conteúdo real será enviado durante a validação.

## Critérios para reativar

- Zero busca por “última mídia” nos caminhos de publicação.
- Toda fila nova contém ID da mídia, tipo esperado e aprovação correspondente.
- A prévia mostra mídia, nome e ID antes da confirmação.
- Todos os cenários de falha encerram sem chamar redes externas.
- Histórico antigo sem vínculo permanece bloqueado.
- A publicação pelo Jarvis só será reativada após sua autorização explícita.
