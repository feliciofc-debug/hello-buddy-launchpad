# Correção do padrão: na dúvida, parar (v3)

Arquivos:
- `supabase/functions/whatsapp-cloud-inbound-processor/index.ts`
- novo `supabase/functions/_shared/post-guardas.ts` (regras puras)
- novo `supabase/functions/_shared/post-guardas.test.ts` (4 testes, dois deles de orquestração)

---

## Resposta sobre `candidatos`

`candidatos` é um **subconjunto**, e você identificou um furo real.

`buscarProdutoParaPostagem` (linha 3517) monta um filtro `ilike` a partir dos tokens da frase e busca `produtos` e `products_stock` com `.limit(80)` cada. Só existe um caminho que traz o catálogo inteiro: o fallback da linha 3558, e ele roda **apenas** quando nenhum candidato pontua acima de zero — com `.limit(500)`.

Ou seja: um produto cujo nome está literalmente na sua frase pode ficar fora se 80 outros registros casarem primeiro com algum token, ou se você tiver mais de 500 produtos.

Por isso o casamento forte **não vai rodar sobre `candidatos`**. Vou adicionar `listarNomesDoCatalogo(userId)`, que busca só `id, nome, source` de `produtos` e `products_stock` do dono, paginado (1000 por página, até esgotar), sem filtro de texto. O casamento forte roda contra essa lista completa; o produto vencedor é então carregado por ID com todos os campos. `buscarProdutoParaPostagem` continua existindo, mas só para gerar a lista de sugestões da pergunta.

---

## 1. Produto só com casamento forte, contra o catálogo inteiro

```ts
// post-guardas.ts — puro
export type ForcaCasamento = "exato" | "palavra_inteira" | "fraco";
export function avaliarCasamentoProduto(query: string, nomes: string[]): {
  forca: ForcaCasamento; indicesFortes: number[];
}
```

Regras:
- `exato`: consulta normalizada igual ao nome do produto.
- `palavra_inteira`: o nome do produto (>= 4 caracteres) aparece na consulta como sequência de palavras inteiras.
- **Nome com menos de 4 caracteres** ("Kit", "Pro", "TV"): só `exato`, comparando a consulta inteira. Nunca substring solta — "posta o kit de ferramentas" não casa com "Kit".
- Todo o resto é `fraco`.

Em `toolPostarRedesSociais` (linha 4060):

```ts
-   const { produto: prod, sugestoes, candidatos } = await buscarProdutoParaPostagem(q, ctx.userId);
-   if (!prod) { ... }
+   const nomes = await listarNomesDoCatalogo(ctx.userId);          // catálogo inteiro, paginado
+   const { forca, indicesFortes } = avaliarCasamentoProduto(q, nomes.map((n) => n.nome));
+   if (forca === "fraco" || indicesFortes.length !== 1) {
+     const { sugestoes } = await buscarProdutoParaPostagem(q, ctx.userId);
+     return JSON.stringify({
+       erro: "produto_nao_identificado",
+       mensagem: "De qual produto do catálogo é o post? Não escolhi nenhum.",
+       candidatos_do_catalogo: indicesFortes.length > 1
+         ? indicesFortes.map((i) => nomes[i].nome)
+         : sugestoes.slice(0, 7),
+     });
+   }
+   const prod = await carregarProdutoPorId(nomes[indicesFortes[0]], ctx.userId);
```

`TERMOS_GENERICOS_PRODUTO` (3976) fica como segunda camada, checada antes. O atalho do roteador (6743) passa pela mesma avaliação antes de chamar o caminho do catálogo.

"postar em todas as redes sociais" → produto = "todas" → `fraco` → pergunta, nenhum pedido criado.

## 2. Prévia falha fechada, com catch específico

`formatSocialPostToolResult` (3727) já é o formatador único dos três estados (`aguardando_escolha_variante` 3732, `variante_selecionada` 3760, `aguardando_confirmacao` 3772). Passa a exigir procedência em todos.

```ts
// post-guardas.ts
export type Procedencia = {
  origem: "biblioteca" | "catalogo";
  produtoNome?: string;        // obrigatório quando origem = catalogo
  midiaIdCurto: string;        // 8 caracteres
  midiaTipo: "foto" | "video";
};
export class PreviaSemProcedenciaError extends Error {}
export function renderProcedencia(p: unknown): string; // lança se faltar qualquer campo
// -> "📌 *Origem:* produto do catálogo: AMZOFERTAS\n🆔 *BD601B92* • Foto"
```

Nos três estados: `const cabecalho = renderProcedencia(data?.procedencia);` antes de montar qualquer balão.

No chamador (~6899), catch **específico**:

```ts
+ } catch (e) {
+   if (e instanceof PreviaSemProcedenciaError) {
+     console.error("[previa][sem_procedencia]", e.message);
+     return "Bloqueei a prévia: o pedido chegou sem a procedência da mídia. Nada foi preparado nem publicado.";
+   }
+   console.error("[previa][falha_tecnica]", (e as Error).message, (e as Error).stack);
+   return "Falha técnica ao montar a prévia. Nada foi preparado nem publicado. O erro foi registrado.";
+ }
```

Query quebrada, timeout ou banco fora recebem a frase de falha técnica e o erro original vai para o log — nunca a frase de procedência.

Os dois caminhos emitem o campo:
- catálogo (4119): `procedencia: { origem: "catalogo", produtoNome: prod.nome, midiaIdCurto: idCurto(assetProduto.id), midiaTipo: "foto" }`, substituindo `origem_do_post` e `instrucao_procedencia`, que dependiam do modelo obedecer.
- biblioteca (4357 e 4829): `procedencia: { origem: "biblioteca", midiaIdCurto: asset.idCurto, midiaTipo: asset.tipo }`.

## 3. Compatibilidade verificada antes de publicar — e a confirmação persistida

```ts
export function verificarCompatibilidadeRedes(
  redes: string[], tipo: "foto" | "video", formato: "feed" | "story" | "reels",
): { compativeis: string[]; incompativeis: { rede: string; motivo: string }[] };
```

TikTok exige vídeo; `reels` exige vídeo; `story` não aceita TikTok.

**Regra nova, permanente:** todo campo de `PendingSocialPost` tem que ser gravado no marcador `jarvis_token:...` e reidratado por `loadPendingSocialPost`. Se não puder ser persistido, não entra no tipo. Nada de estado que morre no cold start.

`pendingPostMarker` passa a gravar dois campos a mais, ao lado de `variantes`/`variantSelecionada`/`tom`:

```ts
  somenteCompativeisConfirmado: pending.somenteCompativeisConfirmado ?? false,
  redesConfirmadas: pending.redesConfirmadas ?? null,
```

e `loadPendingSocialPost` (após a barreira de vínculo da linha 3167, que fica intacta) reidrata os dois do mesmo JSON do marcador.

Em `toolConfirmarPostagemRedes`, antes da linha 4224:

```ts
+ const compat = verificarCompatibilidadeRedes(p.redes, asset.tipo, p.formato || "feed");
+ if (compat.incompativeis.length > 0 && !p.somenteCompativeisConfirmado) {
+   await marcarCompatPendente(token, p.userId, compat.compativeis);  // grava no banco, não no Map
+   return JSON.stringify({ status: "incompatibilidade_de_tipo", token, incompativeis: compat.incompativeis, compativeis: compat.compativeis });
+ }
+ const redesAPublicar = p.redesConfirmadas?.length ? p.redesConfirmadas : compat.compativeis;
- const resultados = await Promise.all(p.redes.map(...));
+ const resultados = await Promise.all(redesAPublicar.map(...));
```

`marcarCompatPendente` reescreve o marcador no banco com `somenteCompativeisConfirmado: false` + `redesConfirmadas: compativeis`. O seu "sim" seguinte faz um `update` no marcador para `somenteCompativeisConfirmado: true` e segue para a publicação. Se a função reciclar entre a pergunta e o "sim", o estado vem do banco e não há loop.

Enquanto houver rede incompatível não confirmada: **zero chamadas de API**.

## 4. Testes de regressão — dois puros, dois de orquestração

`_shared/post-guardas.test.ts`:

1. **Orquestração** — `toolPostarRedesSociais({ produto: "todas", redes: [4 redes] })` com `sb` stubado: retorna `produto_nao_identificado` **e** o stub de `insert` em `social_posts_queue` recebe zero chamadas.
2. **Puro** — `renderProcedencia(undefined)` e `renderProcedencia({ midiaIdCurto: "BD601B92" })` lançam `PreviaSemProcedenciaError`; procedência completa devolve texto com origem, nome, código e tipo.
3. **Orquestração** — pedido com `assetTipo: "foto"` e `redes` incluindo TikTok, confirmado com "sim": o **stub de `publicarEmRede` recebe zero chamadas** e o retorno é `incompatibilidade_de_tipo`. A asserção é sobre a contagem de chamadas.
4. **Puro** — `extrairIdentificadorMidiaDoTurno("publique a mídia ID 727711F0")` resolve o código; `"o pedido a1b2c3d4 saiu"` não resolve.

Para os casos 1 e 3, `toolPostarRedesSociais`, `toolConfirmarPostagemRedes`, o cliente de banco e `publicarEmRede` passam a receber suas dependências por parâmetro opcional (injeção mínima, sem mudar as chamadas existentes) — é o que permite testar o caminho real em vez de só o cálculo. `extrairIdentificadorMidiaDoTurno` (3610) e as três funções puras ficam em `post-guardas.ts`, importadas pelo processador, sem duplicação.

Um teste extra de guarda: `avaliarCasamentoProduto("kit de ferramentas", ["Kit"])` → `fraco`; `avaliarCasamentoProduto("Kit", ["Kit"])` → `exato`.

---

## Fora do escopo, confirmado

Os posts já publicados no Facebook, Instagram e LinkedIn **não serão apagados**, e nenhum caminho de exclusão em conta externa entra neste fluxo. A remoção é manual, por você.

A linha 3167 continua exigindo UUID + tipo. Nenhuma checagem existente é relaxada.
