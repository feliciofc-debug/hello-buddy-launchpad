# TROCA-1.9.2 — origem dos dados (regra “nada inventado”)

## Corrigido nesta versão

| Onde | Antes | Depois |
|------|--------|--------|
| `GestaoTrocaFotoGaleria` | Etiqueta pela posição (`GESTAO_TROCA_FOTO_ETIQUETAS[idx]`); 12ª foto → CRLV | Sempre «A classificar»; CRLV só se o avaliador escolher |
| `normalizeGestaoTrocaFotos` (string legado) | Etiqueta pelo índice do array | «A classificar» |
| `normalizeGestaoTrocaFotos` (objeto legado) | Etiqueta herdada do chute por posição | «A classificar» + `slot_origem: "ia"` na próxima análise |
| `gestaoTrocaResolveFotoSlot` | Inferia slot pela etiqueta legada | Só `slot` explícito no registro |
| `gestaoTrocaFotosOrdenadasParaIa` | Reordenava e inferia slots | Lista na ordem de cadastro; slot informado = usuário ou `a_classificar` |
| Manifest IA | `slot: etiqueta` quando sem slot | `a_classificar` ou slot do usuário |
| Prompt IA | Pedia comentar divergência de slot | Descreve só o visível; identifica ângulo só em fotos «a classificar» |
| Aviso na UI | Texto técnico com id interno | Frase fixa «Foto marcada como …, mas mostra …»; só se `slot_origem === "usuario"` |

## Origens válidas no laudo

- **Informado pelo avaliador:** roteiro (`slot_origem: "usuario"`), etiqueta/CRLV na galeria, km da ficha, espessura digitada, itens confirmados.
- **Foto #n / IA:** achados, `slot_identificado`, textos consolidados, slots preenchidos com `slot_origem: "ia"`.
- **Regra:** indício de colisão, resultado cautelar, resumo por área (`condicao`), parecer comercial.

Sem origem → «A classificar», «não informado» ou vazio; nunca valor default por ordem de upload.
