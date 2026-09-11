# Rede de proteção contra regressões do Jarvis

## Diagnóstico confirmado

O problema de hoje é reproduzível pela ordem atual das regras. A detecção forçada de edição de imagem roda antes da detecção de vídeo e considera palavras como “Instagram” e “Facebook” dentro de uma janela ampla. Assim, o comando de vídeo que também cita essas redes entra em `editar_imagem`; como não havia foto válida, o retorno interno `sem_imagem` apareceu para o usuário.

Não é apenas “memória da IA”: existe uma colisão determinística no roteamento. Corrigir a prioridade já evita este caso, mas a proteção precisa impedir que outra alteração recrie o problema.

## Fase 1 — corrigir a causa e criar testes de intenção

### 1. Roteador determinístico antes do contexto

- Extrair as regras de intenção para um módulo pequeno e testável, separado da função principal do Jarvis.
- Classificar primeiro a mensagem atual, sem usar histórico: `video`, `post`, `editar_imagem`, `publicar`, `aprovar`, `cancelar`, `duvida` ou `ambigua`.
- Aplicar esta precedência:
  1. aprovação/cancelamento, somente quando existir uma operação pendente compatível;
  2. nova intenção explícita da mensagem atual;
  3. continuação do fluxo anterior;
  4. pergunta de esclarecimento quando ainda houver ambiguidade.
- Um pedido explícito de vídeo cancela ou suspende qualquer continuação de edição de imagem. O mesmo vale para post e publicação.
- A regra de edição só poderá usar termos como “Instagram/Facebook” quando também houver pedido explícito de alterar foto, imagem, fundo, cor, cenário ou logo. Citar a rede de destino não será suficiente.
- Estados pendentes serão separados por tipo e por conversa, com prazo de validade. Nenhum estado de imagem poderá capturar um comando de vídeo.
- Antes de executar uma ferramenta, haverá uma última validação: intenção `video` só chama vídeo; intenção `editar_imagem` só chama imagem.

### 2. Mensagens seguras

- Mapear códigos internos como `sem_imagem`, `sem_imagem_retornada` e falhas de ferramentas para mensagens humanas.
- Nunca incluir códigos internos, respostas brutas ou detalhes técnicos na conversa.
- Se a intenção for realmente ambígua, perguntar: “Você quer criar um vídeo ou editar uma imagem?”

### 3. Matriz automatizada de intenção

- Criar uma coleção versionada de frases reais com intenção, parâmetros essenciais e ferramenta esperada.
- Cobrir variações com áudio transcrito, erros de digitação, mensagens longas e mudanças de assunto.
- Casos mínimos:
  - “faz um vídeo sobre X” → `video`;
  - “faz um vídeo animado institucional de 45 segundos...” → `video`, institucional, médio;
  - o comando completo da AMZ que cita Instagram, Facebook, TikTok, LinkedIn e WhatsApp → `video`, nunca imagem;
  - “cria um post sobre X” → `post`;
  - “muda a cor dessa imagem” → `editar_imagem`;
  - “publica em todas” → `publicar`, com confirmação;
  - foto anterior + novo pedido de vídeo → `video`;
  - rascunho de vídeo pendente + “aprovado” → `aprovar_video`;
  - post pendente + “pode publicar” → `aprovar_post`;
  - frase ambígua → pergunta, sem executar ferramenta.
- Adicionar casos negativos para garantir que uma intenção nunca acione a ferramenta errada.
- Rodar esta suíte automaticamente sempre que o roteador, o prompt, as ferramentas ou a função do Jarvis forem alterados. Qualquer divergência bloqueia a publicação.

**Esforço estimado da Fase 1:** 2 a 3 dias úteis, incluindo correção, extração do roteador, cerca de 60–100 frases e relatório legível de falhas.

## Fase 2 — testes completos e bloqueio de publicação

### 1. Testes ponta a ponta controlados

Criar cenários isolados, com conta e dados de teste, sem publicar conteúdo real nem enviar campanhas:

- **Vídeo:** pedido → roteiro → aprovação → criação correta do trabalho de vídeo.
- **Post:** pedido → legenda/arte → aprovação → item pronto para publicação.
- **Publicar em todas:** prévia → confirmação → resultado independente por rede; TikTok identificado como rascunho.
- **Troca de contexto:** edição de imagem → pedido de vídeo → ferramenta de vídeo, sem `sem_imagem`.
- **Aprovação:** aprovação só conclui o item pendente correto; uma aprovação de vídeo não confirma um post e vice-versa.

As integrações externas serão simuladas na rotina automática. Um teste real autenticado e sem campanha ficará como validação controlada de liberação, executada apenas com autorização explícita.

### 2. Checklist obrigatório antes de publicar o Jarvis

1. Suíte de intenção aprovada integralmente.
2. Troca imagem → vídeo aprovada com o comando completo da AMZ.
3. Vídeo, post, publicação e aprovação aprovados ponta a ponta.
4. Nenhum código interno aparece nas respostas ao usuário.
5. Publicação em todas exige confirmação e mantém o WhatsApp fora.
6. Consultas e estados continuam isolados por cliente e conversa.
7. Alteração revisada somente nas funções afetadas; sem publicação conjunta das demais funções.
8. Resultado registrado antes da liberação e plano de reversão pronto.

### 3. Barreira de publicação

- Criar um único comando de verificação do Jarvis para executar intenção, fluxo e validações estáticas.
- Integrá-lo ao processo de publicação: mudanças no Jarvis não avançam se a verificação falhar.
- Manter o restante das funções fora desse bloqueio inicialmente; ampliar a cobertura por risco, não tentar testar 193 funções de uma vez.
- Registrar para cada caso a frase, intenção esperada, intenção obtida e ferramenta escolhida, facilitando diagnóstico sem expor dados de clientes.

**Esforço estimado da Fase 2:** 3 a 5 dias úteis para a primeira rede de ponta a ponta e a barreira de publicação. Depois, cada novo fluxo crítico adiciona normalmente algumas horas de trabalho.

## Critérios de aceite

- O comando completo “faz um vídeo animado institucional de 45 segundos...” é classificado como vídeo mesmo após uma edição de imagem.
- Nenhuma ferramenta de imagem é chamada nesse cenário.
- `sem_imagem` e outros códigos internos nunca chegam ao usuário.
- Todos os casos da matriz passam antes da publicação.
- Os quatro fluxos críticos possuem ao menos um cenário completo aprovado.
- Nenhuma campanha ou mensagem de WhatsApp é disparada pelos testes.

## Recomendação

Executar primeiro a Fase 1, pois ela corrige a causa de hoje e entrega retorno rápido. Em seguida, implantar a Fase 2 como requisito permanente para qualquer alteração futura no Jarvis. Até a correção entrar em produção, o formulário da plataforma continua sendo o caminho seguro para gerar o vídeo.
