# Queima de legenda na VPS — arquitetura recomendada

Objetivo: tirar a queima da legenda do navegador do cliente, para que o fluxo "vídeo pelo WhatsApp → transcrição → 3 copies → escolha → publicação" rode sozinho, sem plataforma aberta.

Escopo desta rodada: plano. Nada de código.

---

## 1. Arquitetura recomendada

**Recomendação: fila no banco + worker na VPS que faz polling, e a VPS avisa o fim por webhook na edge function.** (mistura das opções B e C, sem HTTP síncrono)

Por que não as outras:

- **Edge function chamando e aguardando**: descartado. A queima leva de dezenas de segundos a minutos e a edge function tem limite de execução — a chamada morre antes do encode terminar. Também acopla o fluxo do WhatsApp ao tempo de encode.
- **Edge function dispara e a VPS responde por webhook (sem fila)**: quase certo, mas se a VPS estiver fora do ar no momento do disparo o trabalho se perde. A fila resolve isso de graça.
- **Só polling, sem webhook**: funciona, mas o fluxo do WhatsApp precisa reagir ao fim do encode (publicar e avisar o cliente). O webhook evita que a plataforma tenha que ficar perguntando "acabou?".

Fluxo:

```text
WhatsApp (vídeo) → inbound processor → transcreve (já existe)
                                     → gera 3 copies → manda A/B/C
cliente escolhe + confirma
   → INSERT em video_render_jobs (status=pendente)
VPS worker (poll a cada ~10s) → claim do job → baixa vídeo → FFmpeg
   → sobe MP4 no Storage → POST no webhook da edge function
edge function → publica nas redes → avisa o cliente no WhatsApp
```

A fila dá: retentativa natural, visibilidade do estado, e tolerância a VPS reiniciando. O worker é a única peça nova na VPS, e ela nunca precisa ser alcançável para o trabalho ser aceito.

## 2. Transporte do arquivo

- **Ida**: a VPS **baixa do Storage por URL assinada** gerada no momento do claim (validade curta, ~1h). Sem upload na requisição — o vídeo já está no Storage quando chega pelo WhatsApp, então subir de novo seria tráfego duplicado e um corpo HTTP grande sem ganho.
- **Volta**: **a VPS grava o MP4 processado no Storage**, usando um endpoint de upload assinado que a plataforma entrega junto do job. Isso evita mandar dezenas de MB de volta por webhook, e evita dar service role key para a VPS.
- O webhook de conclusão carrega só o caminho do arquivo final + duração + metadados. Payload pequeno.

Bucket: reaproveitar o bucket de vídeos já em uso, em uma pasta `legendados/`.

## 3. Autenticação

Dois segredos distintos, um para cada direção:

- **VPS → plataforma** (claim do job, upload, webhook de conclusão): um token único (`VPS_RENDER_TOKEN`), enviado em header. Guardado nos secrets do backend do meu lado, e no `.env` do container do lado da VPS. Toda edge function que a VPS chama valida esse header em tempo constante e roda com `verify_jwt = false`.
- **Plataforma → VPS**: nesta arquitetura **não existe** chamada da plataforma para a VPS. É a maior vantagem de segurança do desenho: o worker pode ficar sem porta nenhuma exposta na internet — sem subdomínio, sem certificado, sem superfície de ataque. Só faz chamadas de saída.

Como o dono me passa o valor: eu **gero** o token pelo lado do backend e mostro para ele copiar uma única vez para o `.env` da VPS. Ele não precisa me enviar segredo nenhum, e o valor não entra no repositório em momento algum.

Se mais adiante houver necessidade de um endpoint HTTP na VPS (por exemplo para render sob demanda), aí sim: subdomínio próprio, Let's Encrypt no Nginx que já existe, e o mesmo token em header — mas não é necessário agora.

## 4. Tratamento de falhas

| Situação | Comportamento |
|---|---|
| VPS fora do ar quando o vídeo chega | Job fica `pendente`. Quando o worker volta, pega. Nada se perde. |
| Encode falha (arquivo corrompido, formato exótico) | Worker marca `erro` com a mensagem, `tentativas + 1`. |
| Retentativa | Automática até 3 tentativas, com espera crescente. Depois disso o job vai para `falha_definitiva`. |
| Worker morre no meio | O claim tem prazo. Job travado em `processando` por mais de ~15 min volta para `pendente`. |
| Demora acima do normal | Se passar de ~5 min sem conclusão, o cliente recebe no WhatsApp um "estou finalizando seu vídeo, já te aviso" para o silêncio não parecer abandono. |
| Falha definitiva | O cliente é avisado no WhatsApp em linguagem simples: não deu para gerar a legenda, mas o vídeo pode ser publicado sem ela — com botão para escolher. O fluxo nunca fica travado esperando. |

Sobre a janela de 24h da Meta: a confirmação do cliente reabre a janela, então a resposta pós-encode cabe dentro dela na quase totalidade dos casos. Se o encode estourar a janela, a notificação sai por template aprovado em vez de mensagem livre.

O monitoramento de saúde que já existe na plataforma passa a incluir "há job pendente há mais de X minutos" — isso é o alarme de VPS caída.

## 5. O que precisa ser criado na VPS

Um container único, sem porta publicada. Quem instalar precisa de:

- **FFmpeg** (imagem base com FFmpeg já embutido resolve; não precisa instalar no host)
- **Docker Compose** com restart automático, junto dos containers que já rodam
- **`.env`** com: a URL base das funções do backend, o `VPS_RENDER_TOKEN`, e o intervalo de polling
- **Sem Nginx, sem subdomínio, sem certificado** — o worker só faz chamadas de saída
- Espaço de trabalho em disco (`/var/lib/render-worker/tmp`), limpo após cada job. Pico estimado: alguns GB.
- Limite de **1 job por vez** (`concurrency=1`) na largada, para não competir com os outros dois projetos da máquina. Com 6 vCPU dá para subir depois.

O worker faz, em loop:

1. `POST /render-jobs-claim` → recebe job + URL assinada do vídeo + segmentos de legenda + destino de upload
2. Baixa o vídeo, roda FFmpeg com os overlays de legenda
3. Sobe o MP4 no destino informado
4. `POST /render-jobs-complete` com resultado (ou erro)

Nada além disso. A lógica de negócio, publicação e WhatsApp fica toda do meu lado.

**Detalhe técnico importante**: hoje os blocos de legenda são desenhados como PNG no Canvas do navegador (para usar a fonte do sistema). Na VPS não há Canvas, então o worker precisa das fontes instaladas na imagem e vai desenhar a legenda pelo próprio FFmpeg. Isso é o único ponto onde o resultado pode sair visualmente diferente do que existe hoje — vou definir o estilo (fonte, tamanho, caixa escura, posição) para ficar equivalente, e vale conferir o primeiro vídeo lado a lado.

## 6. Padrão já usado neste projeto

Sim, e é o motivo da recomendação acima: o projeto já opera exatamente esse padrão de fila em outros lugares — enfileirar no banco, um consumidor puxando o trabalho, e agendamento disparando processamento de forma assíncrona em vez de segurar a requisição. Também já existe o padrão de função de backend com `verify_jwt = false` protegida por token em header, usado pelo gateway. Estou reaproveitando os dois em vez de inventar transporte novo — menos peça nova, e o time já sabe depurar isso.

---

## Divisão da execução (rodada seguinte, após sua revisão)

**Meu lado (backend/plataforma):**
1. Migration: tabela de fila de render + colunas de estado. Sem tocar em RLS.
2. Funções de claim, upload assinado e conclusão, protegidas pelo token.
3. Geração do token e entrega do valor para o `.env` da VPS.
4. Integração no fluxo do WhatsApp: 3 copies a partir da transcrição, escolha A/B/C, confirmação, enfileiramento, publicação ao fim e aviso ao cliente.
5. Reciclagem de jobs travados e alarme de fila parada.

**Lado da VPS (dono + apoio):** Docker Compose do worker com FFmpeg e fontes, `.env`, restart automático.

**Fora de escopo:** RLS, fluxo do TikTok (em auditoria), quota de uso, e a queima no navegador — que continua funcionando como está para quem usa a plataforma no computador.
