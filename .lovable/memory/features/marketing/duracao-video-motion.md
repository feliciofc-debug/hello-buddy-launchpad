---
name: Duração dos vídeos animados
description: Presets curto/médio/longo mudam volume de conteúdo (blocos, itens, mensagens) e ritmo das cenas
type: feature
---

Presets de duração do vídeo Motion (`duracao`: `curto` | `medio` | `longo`):

- curto (padrão, ~20-25s): 3 blocos / 3 itens / 4 mensagens
- medio (~40s): 6 blocos / 6 itens / 8 mensagens
- longo (~60s): 9 blocos / 9 itens / 12 mensagens

Regra central: mais duração = MAIS conteúdo, nunca cena mais lenta. O `ritmo`
(frames por cena) só aumenta o tempo de leitura (`RITMO_POR_DURACAO` em
`_shared/video-motion.ts`) e é lido pelos templates Remotion via prop `ritmo`.

Com muitos argumentos, o arranjo é forçado para "uma cena por argumento"
(institucional arranjo 2 acima de 4 blocos; lista arranjo 3 acima de 5 itens).

Render na VPS: ~10s de render por 1s de vídeo (`minutosRenderEstimado`). O
usuário e o Jarvis recebem essa estimativa antes de aprovar. Worker é
single-thread: vídeo longo ocupa a fila por mais tempo.

O Jarvis aceita "faz um vídeo longo sobre X" (`duracaoPedidaNoTexto`) e o
parâmetro `duracao` na ferramenta `criar_video_animado`.
