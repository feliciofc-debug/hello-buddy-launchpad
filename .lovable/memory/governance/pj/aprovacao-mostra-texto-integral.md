---
name: Aprovação mostra o texto integral e sem segmento alheio
description: Toda aprovação exibe o texto exato que vai ao ar (1 mensagem por opção) e copy com nicho ausente do pedido é rejeitada
type: preference
---
Em QUALQUER aprovação (posts, roteiros, campanhas), o dono precisa ver exatamente o que vai ao ar — nunca uma descrição/resumo do conteúdo.

- Fluxo A/B/C do WhatsApp manda **uma mensagem por opção** com o texto integral (`formatSocialPostToolResult`).
- Resposta do modelo que descreve as opções ("Opção A (Direta): foco em...") é RECUSADA no final do loop via `pareceResumoDeOpcoes` (`_shared/aprovacao-integra.ts`) e o agente pede a mídia para gerar as copies de verdade.
- Vazamento de contexto entre pedidos cobre TEXTO e SEGMENTO, não só logo/cores: `segmentoIntruso` compara o nicho da copy com o contexto do pedido (nome, descrição, briefing, marca) e descarta/regenera quando aparece nicho alheio (ex.: dentista/consultório num pedido institucional da AMZ).
- Causa raiz do caso dentista: o modelo respondeu SEM chamar a ferramenta, reciclando conteúdo antigo do histórico da conversa.
- Testes: `_shared/aprovacao-integra.test.ts`.
