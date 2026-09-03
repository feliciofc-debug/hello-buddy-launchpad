# Áudio nos vídeos animados (Remotion)

Antes do plano, as três respostas que você pediu — e uma correção importante.

## 1. De onde vêm as faixas hoje?

**Não existe biblioteca de áudio na plataforma.** Auditei o banco e o storage:

- Buckets existentes: `videos`, `produto-videos`, `carousels`, `ebooks`,
  `tenant-logos`, `user-logos`, `produtos`, `midias-whatsapp`, `backups`,
  `silvester-docs`, `tenant-ebooks`, `meta-media-cache`. **Nenhum de áudio.**
- Tabelas: `videos`, `produto_videos`, `video_motion_jobs`,
  `video_motion_rascunhos`, `videos_agendados`... **nenhuma tabela de trilhas.**
- O único áudio no sistema é TTS (ElevenLabs) para voz no WhatsApp, e a
  transcrição de vídeos enviados. Isso é voz, não trilha musical.

Ou seja: a parte 1 do seu pedido não é "reaproveitar", é **construir a
biblioteca**. É pequeno, mas precisa existir.

## 2. Licença — resposta direta

Não há licença hoje, porque não há acervo. Então nada cobre nossos clientes
publicando comercialmente. Você está certo em travar isso por escrito.

Três caminhos, em ordem de risco:

| Opção | Custo | Cobre o cliente publicando? |
|---|---|---|
| CC0 / domínio público (Pixabay Music, Free Music Archive CC0) | zero | Sim, uso comercial livre, sem atribuição obrigatória. Risco: catálogos com upload de terceiros já tiveram faixas retiradas — precisa arquivar o comprovante da licença de cada faixa. |
| Licença de biblioteca comercial (Epidemic, Artlist, Soundstripe) | assinatura mensal | **Só cobre a nossa conta.** Distribuir a faixa para o cliente publicar no canal dele normalmente exige plano "multi-client"/enterprise. Sem isso, é violação nossa, não do cliente. |
| Faixa própria (encomendada ou gerada por IA com direitos cedidos) | pontual | Sim, e sem terceiro para nos retirar o direito depois. |

Recomendação: começar com **CC0 curado por nós** (5–8 faixas), guardando o
comprovante de licença em cada registro, e deixar o cliente subir a própria
trilha. Nenhuma faixa de biblioteca por assinatura sem plano multi-cliente
contratado. Content ID do Instagram/TikTok pode silenciar o áudio mesmo com
faixa CC0 — por isso o campo é opcional e o vídeo sem som segue válido.

## 3. Impacto no tempo de render

Praticamente nulo: **+5 a +15 segundos** nos ~4 minutos atuais. Remotion baixa a
faixa uma vez e mixa no passo final do ffmpeg; não há custo por frame.

Porém há **um bloqueio real**: hoje o render roda com `muted: true`
(`remotion/scripts/render-template.mjs`), justamente porque o ffmpeg do ambiente
não tinha encoder AAC. Precisa validar na VPS que o ffmpeg tem `aac`
(`ffmpeg -encoders | grep aac`). Se não tiver, o render com áudio falha — é o
primeiro item a checar antes de qualquer código.

---

## Plano

### Fase 0 — verificação (antes de código)
Confirmar `aac` no ffmpeg da VPS. Se faltar, instalar/recompilar ffmpeg.

### Fase 1 — biblioteca de trilhas
- Bucket público `trilhas-audio`.
- Tabela `trilhas_sonoras`: `id`, `nome`, `descricao`, `mood`
  (energetico/corporativo/suave/inspirador), `duracao_seg`, `storage_path`,
  `licenca` (texto: fonte + tipo), `licenca_url`, `user_id` (nulo = trilha
  global da plataforma), `ativo`. RLS: leitura das globais para
  `authenticated` + das próprias; escrita apenas nas próprias. GRANTs
  explícitos.
- Seed com 5–8 faixas CC0 curadas, cada uma com licença registrada.
- Upload da própria trilha pelo cliente (MP3/M4A, até 10 MB).

### Fase 2 — seleção no formulário
Em `CriarVideoAnimado.tsx`: campo opcional "Trilha sonora" com prévia
(player HTML simples), agrupado por mood, mais "Sem trilha" (padrão) e
"Enviar minha trilha". A URL vai em `video_motion_jobs.trilha_url` +
`trilha_volume`.

### Fase 3 — Remotion
No `templates/agente/Template.tsx`:

```tsx
{trilhaUrl && (
  <Audio src={trilhaUrl} volume={f =>
    interpolate(f, [0, 20, dur - 45, dur], [0, 0.28, 0.28, 0], {extrapolateLeft:'clamp', extrapolateRight:'clamp'})
  } />
)}
```

Corte automático pela duração da composição (Remotion trunca sozinho), fade in
de ~0.7 s e fade out de 1.5 s no final. Volume base 0.28 — trilha de fundo,
não protagonista. `muted: false` no render script quando houver trilha.

### Fase 4 — Jarvis (WhatsApp)
Sua preferência: trilha padrão do cadastro, sem perguntar. Novo campo
`empresa_config.trilha_padrao_id`. O `enfileirarVideoMotion` lê esse campo e
aplica. Se o cadastro não tiver trilha definida → vídeo sem som, sem
pergunta. A conversa não muda em nada. O usuário ainda pode dizer "sem
música" ou "com música animada" no pedido, e o roteiro respeita.

## Sobre o vídeo de prova social

Recebi o `amz-whatsapp-prova.mp4`. Consigo mixar uma trilha nele em um
minuto — mas só faço isso com um arquivo de trilha que você me envie, ou
depois de você aprovar uma das faixas CC0 que eu curar. Não vou colocar
áudio de origem incerta em material de prova social que vai para a Meta.

## Escopo desta entrega
Nada foi alterado ainda. Fases 1–4 são uma rodada de implementação; a Fase 0
depende de um comando na VPS que eu te passo.
