# Post pelo WhatsApp — vínculo de mídia, roteamento e mensagens (v2)

Plano revisado com os três bloqueios. Nada aplicado ainda.

## Bloqueio 1 — por que "posta isso" foi para o catálogo

Existem duas ferramentas de post e a escolha é do modelo:

- caminho da biblioteca (`postar_midia_biblioteca`, linha 5336): **exige o identificador da mídia**
  (`midia_id` obrigatório, linha 5341).
- caminho do catálogo (`postar_redes_sociais`, linha 5260): exige apenas uma **palavra-chave de produto**
  (linha 5270, `required: ["produto"]`).

Na sua conversa, a mensagem do vídeo trouxe o **código curto** (`727711F0`), não o identificador completo.
O modelo não tinha o identificador completo para chamar o caminho da biblioteca, então caiu no caminho
que aceita texto livre. Lá, a busca por produto é aproximada: ela devolve o "melhor parecido" do catálogo
mesmo quando o pedido não nomeia produto nenhum — e devolveu um item de odontologia. O vídeo da
veterinária nunca entrou no post.

Ou seja: o erro de token foi o que impediu a publicação errada. Concordo integralmente com o bloqueio.

### Correções do Bloqueio 1

1. **Pedido de post logo depois de mídia aprovada vai obrigatoriamente para a biblioteca.** Antes de o
   modelo escolher ferramenta, o processador resolve o código curto/identificador citado na conversa
   (função `buscarMidiaIdentificadaParaPostagem`, já existente, linha 3559) e força o caminho da
   biblioteca com aquele identificador. O caminho do catálogo fica **indisponível naquele turno**.
2. **Caminho do catálogo só com produto nomeado.** `postar_redes_sociais` passa a recusar pedido cuja
   palavra-chave seja genérica ("isso", "esse vídeo", "o post", "a mídia", "aquilo") ou vazia, e a recusar
   correspondência aproximada fraca: se a busca não devolver um produto claramente correspondente ao nome
   dito, a resposta é "de qual produto do catálogo é o post?" — não escolhe nada.
3. **Prévia diz a procedência.** Todo post do catálogo passa a abrir com
   `post do produto: <nome do produto>` (e o post de mídia continua mostrando código curto, tipo e nome
   do arquivo). Se a procedência não bater, você cancela na primeira linha.
4. Nenhum "mais recente", "último produto" ou "produto do contexto" em qualquer ramo. Sem identificação,
   o Jarvis pergunta.

## Bloqueio 2 — escolho a (a)

Removo o fallback de "última foto dos últimos 30 minutos" em `toolEditarImagem` (linhas 1136–1146).
Sem imagem no turno, a resposta é o bloco `sem_imagem` já existente (linhas 1151–1156), pedindo a foto.
Não vou usar a (b): concordo que ela deixa o canal aberto.

Com o fallback fora, o registro da foto do produto na biblioteca deixa de alimentar vazamento. E o
registro passa a ter `origem: "catalogo_produto"` de qualquer forma, para auditoria.

## Bloqueio 3 — prefixo decide, não o caixa

Ordem correta na confirmação (linha 3997 em diante), sobre a **string crua**, antes de qualquer
normalização:

1. tem `p_` → é código de pedido; segue.
2. não tem `p_` e casa 8 hex (qualquer caixa) → tenta como código antigo; **se não achar pedido**,
   responde "isso parece o código de uma mídia, não de um pedido de post — me diga qual post confirmar".
3. nada disso → "código inválido".

A compatibilidade sem prefixo fica com data de corte explícita no código:

```ts
// Compatibilidade com códigos antigos sem prefixo. Remover após 2026-10-15.
const ACEITA_TOKEN_SEM_PREFIXO_ATE = Date.parse("2026-10-15T00:00:00Z");
```

Passada a data, código sem prefixo é recusado com a mensagem do item 2.

## Os três itens menores

- **Limpeza:** rodo o seu `update` no mesmo deploy, cancelando todo `aguardando_confirmacao` com
  `asset_id` nulo, com `error_message = 'sem_vinculo_midia_pre_correcao'`.
- **`status: "pendente"`:** conferido — `resolverAsset` (`_shared/publicacao-por-id.ts`, linha 80) só
  considera bloqueado o status que casa `/bloquead/i`. "pendente" publica normalmente.
- **Roteiro e post pendentes juntos:** sem precedência adivinhada. Havendo os dois, o "sim" não executa
  nada e o Jarvis responde "quer publicar o post ou renderizar o vídeo?", com os dois identificados
  (código do post e código curto da mídia). Só depois da escolha a ferramenta roda.

## Resumo das mudanças por arquivo

`supabase/functions/whatsapp-cloud-inbound-processor/index.ts`
- 1136–1146: remove fallback de foto recente.
- ~3560: reaproveita `buscarMidiaIdentificadaParaPostagem` para forçar o caminho da biblioteca.
- ~3133–3175 (`loadPendingSocialPost`): retorna motivo (`nao_encontrado` / `expirado` /
  `sem_vinculo_midia`) em vez de `null`.
- ~3920 (`postar_redes_sociais`): recusa palavra-chave genérica e correspondência fraca.
- ~3967: token com prefixo `p_`.
- ~3968: resolve e registra a mídia aprovada; `assetId`/`assetTipo` obrigatórios; falha imediata se não
  resolver ("não consegui identificar a mídia aprovada").
- ~3997 e nas outras três ferramentas de token: validação sobre a string crua, na ordem do Bloqueio 3, com
  mensagens distintas.
- ~5260: descrição da ferramenta de catálogo exige produto nomeado.
- ~8596: guard de pendências — bloqueia geração de vídeo no "sim" e pergunta quando há post e roteiro.

Novo helper `resolverAssetDoProduto(userId, produto)` no mesmo arquivo (procura por
`user_id + midia_url`; insere com `origem: "catalogo_produto"`, `tipo: "foto"`, `status: "pendente"`).

Nada de checkout/pagamento é tocado. A checagem da linha 3167 continua intacta.

## Validação (seu roteiro)

1. Vídeo de clínica veterinária pelo WhatsApp, aprovar.
2. Pedir o post desse vídeo → textos só de veterinária; qualquer menção a odonto reprova.
3. Conferir `asset_id` = identificador do vídeo aprovado e código curto igual ao da mensagem do vídeo.
4. Só então "sim" → publica.
5. Mandar código de mídia no lugar do código do pedido → resposta explica a diferença.
6. Sua query: nenhuma linha nova com `asset_id` nulo.
