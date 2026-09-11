# Corrigir o post do WhatsApp que nunca confirma

Sua análise está certa em todos os pontos. Confirmei no arquivo `whatsapp-cloud-inbound-processor/index.ts`:
o caminho do catálogo grava o pedido de post **sem** identificação da mídia, e a checagem de segurança
(correta) recusa esse pedido na confirmação. Resultado: 100% dos posts criados por esse caminho falham.

## Respostas diretas às suas perguntas

**Existe outro ponto que cria pedido pendente?** Não. Só dois: linha 3969 (catálogo, quebrado) e
linha 4653 (mídia da biblioteca, correto). Varri o arquivo por `status: "aguardando_confirmacao"` —
os outros resultados são leituras/atualizações, não criação.

**De onde sai a identificação da mídia no caminho do catálogo?** Esta é a parte de risco e a solução é
canonizar: o produto do catálogo tem uma foto (uma URL), e URL não é identidade. Então, antes de criar o
pedido, a foto do produto passa a ser **registrada como item da biblioteca de mídias daquela conta**
(reaproveitando o registro se a mesma foto do mesmo produto já estiver lá). O pedido de post nasce
apontando para esse registro. A partir daí, geração, aprovação e publicação usam o mesmo identificador —
igual ao caminho que já funciona. Se o produto não tiver foto, ou o registro falhar, a preparação
**falha na hora**, com a frase "não consegui identificar a mídia aprovada". Nunca mais nasce um pedido
sem identificação.

**Decisão sobre o item 2 (prefixo):** concordo, com o prefixo `p_`. O código do pedido passa a ser
`p_` + 8 caracteres; o código da mídia continua 8 caracteres em maiúsculas. Aceito também o código antigo
sem prefixo por 2 horas (o tempo de vida do pedido), para não quebrar conversas em andamento. Se chegar um
código de mídia no lugar do código do pedido, a resposta é: "esse é o código de uma mídia, não de um
pedido de post — me diga qual post confirmar".

## O que muda

1. **Preparação do post pelo catálogo (linha ~3968)** — resolve e registra a mídia aprovada,
   passa identificação e tipo no pedido; sem isso, erro imediato e nenhum pedido criado.
2. **Checagem de segurança na leitura (linha 3167)** — fica como está. O erro é de quem grava.
3. **Mensagens de erro** — três causas passam a ter três frases distintas:
   - pedido inexistente: "não achei esse pedido de post"
   - pedido vencido: "esse pedido passou de 2 horas — refaça"
   - sem mídia identificada: "esse pedido ficou sem mídia identificada e não pode publicar; refaça"
   - código de mídia enviado como código de pedido: frase própria, explicando a diferença.
4. **Código do pedido com prefixo `p_`** e validação ajustada nas quatro ferramentas que recebem código
   (confirmar, escolher variante, revisar, cancelar).
5. **"sim" nunca cai na geração de vídeo** — quando existe pedido de post aguardando confirmação,
   uma resposta curta de confirmação vira publicação, e a ferramenta de vídeo animado é bloqueada
   naquele turno. Assim a mensagem "esse mesmo vídeo já foi pedido nos últimos minutos" não aparece
   mais em resposta a um "sim".

## Detalhes técnicos

- Novo helper `resolverAssetDoProduto(userId, produto)` no processador: procura em `midias_whatsapp`
  por `user_id + midia_url` igual à foto do produto; se não existir, insere com
  `origem: "catalogo_produto"`, `tipo: "foto"`, `status: "pendente"`, `contexto_original` = nome do
  produto. Retorna `{ id, tipo }` ou erro. Nunca reaproveita item com `status` bloqueado.
- `toolPostarRedesSociais` (3968): chama o helper antes de montar `pending`; adiciona
  `assetId`, `assetTipo: "foto"`, `midiaTipo: "foto"` — mesmo shape da linha 4652.
- `loadPendingSocialPost`: retorna `{ erro: "nao_encontrado" | "expirado" | "sem_vinculo_midia" }`
  em vez de `null`, para as mensagens ficarem distintas; `console.error` mantém
  `[social_confirm][asset_binding_missing]`.
- Token: `const token = "p_" + crypto.randomUUID().replace(/-/g,"").slice(0,8)`; regex passa a
  `/^(p_)?[a-f0-9]{8}$/`; se o texto casar `/^[A-F0-9]{8}$/` (maiúsculo, formato de ID de mídia),
  responde erro `token_e_id_de_midia`.
- Dedupe: o guard de confirmação pendente (bloco `pendingConfirmBlock`, ~linha 8596) passa a também
  desabilitar `criar_video_animado` na lista de ferramentas daquele turno quando o texto é confirmação
  curta ("sim", "ok", "pode postar", "publica", "manda", "vai"). A trava de duplicidade em
  `_shared/video-motion-enfileirar.ts` não muda.
- Nenhuma alteração em arquivos de checkout/pagamento.

## Como validar (o seu roteiro)

1. Pedir vídeo pelo WhatsApp e aprovar.
2. Pedir o post, escolher B, responder "sim" → publica.
3. Rodar sua query e conferir `asset_id` preenchido (UUID) e `approval_token` começando com `p_`.
4. Mandar um código curto de mídia no lugar do código do pedido → resposta explica a diferença.
