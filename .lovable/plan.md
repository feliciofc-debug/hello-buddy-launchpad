# Correção do padrão: na dúvida, parar

Quatro mudanças no fluxo de post do WhatsApp. Nenhuma delas depende de lista de palavras para funcionar.

Arquivos:
- `supabase/functions/whatsapp-cloud-inbound-processor/index.ts`
- novo `supabase/functions/_shared/post-guardas.ts` (regras puras, testáveis)
- novo `supabase/functions/_shared/post-guardas.test.ts` (os 4 testes de regressão)

---

## 1. Produto só com casamento forte (inverte a regra)

Hoje `toolPostarRedesSociais` (linha 4060) usa `buscarProdutoParaPostagem`, que ordena por score de similaridade e devolve `ranked[0]`. Qualquer palavra que gere score > 0 vira produto. Foi assim que "todas" virou AMZOFERTAS.

Novo em `post-guardas.ts`:

```ts
export type ForcaCasamento = "exato" | "palavra_inteira" | "fraco";

// Puro: recebe a consulta e os nomes; não fala com banco.
export function avaliarCasamentoProduto(query: string, nomes: string[]): {
  forca: ForcaCasamento;
  indicesFortes: number[];   // candidatos com casamento forte
}
```

Regra: `exato` = consulta normalizada igual ao nome. `palavra_inteira` = o nome do produto aparece na consulta como sequência de palavras inteiras (>= 4 caracteres). Tudo o mais é `fraco`.

Em `toolPostarRedesSociais` (linha 4060 em diante):

```ts
-   const { produto: prod, sugestoes, candidatos } = await buscarProdutoParaPostagem(q, ctx.userId);
-   if (!prod) { ...sugestoes... }
+   const { candidatos, sugestoes } = await buscarProdutoParaPostagem(q, ctx.userId);
+   const { forca, indicesFortes } = avaliarCasamentoProduto(q, candidatos.map((c) => c.nome));
+   if (forca === "fraco" || indicesFortes.length !== 1) {
+     return JSON.stringify({
+       erro: "produto_nao_identificado",
+       mensagem: "De qual produto do catálogo é o post? Não escolhi nenhum.",
+       candidatos_do_catalogo: sugestoes.slice(0, 7),
+     });
+   }
+   const prod = candidatos[indicesFortes[0]];
```

Consequências:
- zero, mais de um, ou um só com casamento fraco → pergunta e lista candidatos. Nunca escolhe.
- similaridade continua existindo, só para montar a lista de sugestões.
- `TERMOS_GENERICOS_PRODUTO` (linha 3976) permanece como segunda camada, checada antes.
- o atalho do roteador (linha 6743) passa a exigir o mesmo casamento forte antes de chamar o caminho do catálogo.

"postar em todas as redes sociais" → `redes` = as quatro, produto = "todas" → casamento fraco → pergunta.

## 2. Prévia falha fechada

`formatSocialPostToolResult` (linha 3727) já é o formatador único dos três estados de prévia (`aguardando_escolha_variante` 3732, `variante_selecionada` 3760, `aguardando_confirmacao` 3772). O problema é que nenhum deles exige procedência.

Novo em `post-guardas.ts`:

```ts
export type Procedencia = {
  origem: "biblioteca" | "catalogo";
  produtoNome?: string;          // obrigatório quando origem = catalogo
  midiaIdCurto: string;          // 8 caracteres
  midiaTipo: "foto" | "video";
};

export class PreviaSemProcedenciaError extends Error {}

// Lança PreviaSemProcedenciaError se faltar qualquer campo.
export function renderProcedencia(p: unknown): string;
// -> "📌 *Origem:* produto do catálogo: AMZOFERTAS\n🆔 *BD601B92* • Foto"
```

No formatador, os três estados passam a começar por:

```ts
+ const cabecalho = renderProcedencia(data?.procedencia); // lança se faltar
```

Sem `procedencia` válida, o formatador lança; o chamador (linha ~6899) captura e envia apenas: "Bloqueei a prévia: o pedido chegou sem a procedência da mídia. Nada foi preparado nem publicado." Nenhuma opção A/B/C é exibida, então não existe o que confirmar.

Os dois caminhos passam a emitir o campo:
- catálogo (linha 4119): `procedencia: { origem: "catalogo", produtoNome: prod.nome, midiaIdCurto: idCurto(assetProduto.id), midiaTipo: "foto" }` — substitui `origem_do_post` e `instrucao_procedencia`, que dependiam do modelo obedecer.
- biblioteca (linhas 4357 e 4829): `procedencia: { origem: "biblioteca", midiaIdCurto: asset.idCurto, midiaTipo: asset.tipo }`.

## 3. Verificação de compatibilidade antes de qualquer publicação

Hoje a publicação é `Promise.all` sobre as redes (linha 4224) e o TikTok descobre a incompatibilidade dentro da própria chamada.

Novo em `post-guardas.ts`:

```ts
export function verificarCompatibilidadeRedes(
  redes: string[], tipo: "foto" | "video", formato: "feed" | "story" | "reels",
): { compativeis: string[]; incompativeis: { rede: string; motivo: string }[] };
```

Regras: TikTok exige vídeo; `reels` exige vídeo; `story` não aceita TikTok.

Em `toolConfirmarPostagemRedes`, imediatamente antes da linha 4224:

```ts
+ const compat = verificarCompatibilidadeRedes(p.redes, asset.tipo, p.formato || "feed");
+ if (compat.incompativeis.length > 0 && !p.somenteCompativeisConfirmado) {
+   PENDING_POSTS.set(token, { ...p, compatPendente: compat });
+   return JSON.stringify({
+     status: "incompatibilidade_de_tipo",
+     mensagem_partes: [...],   // redes recusadas + motivo + pergunta
+     token,
+   });
+ }
+ const redesAPublicar = p.somenteCompativeisConfirmado ? compat.compativeis : p.redes;
- const resultados = await Promise.all(p.redes.map(...));
+ const resultados = await Promise.all(redesAPublicar.map(...));
```

Nada é publicado enquanto houver rede incompatível. O Jarvis lista as recusadas e pergunta se segue só com as compatíveis; um novo "sim" marca `somenteCompativeisConfirmado` e publica só essas.

## 4. Testes de regressão

`_shared/post-guardas.test.ts`, rodando com `deno test`, quatro casos:

1. `avaliarCasamentoProduto("todas as redes sociais", ["AMZOFERTAS", "Consultório Odontológico"])` → `fraco`, zero candidatos fortes.
2. `renderProcedencia({ midiaIdCurto: "BD601B92" })` e `renderProcedencia(undefined)` → lançam `PreviaSemProcedenciaError`; `renderProcedencia` completo → texto com origem, nome, código e tipo.
3. `verificarCompatibilidadeRedes(["facebook","instagram","linkedin","tiktok"], "foto", "feed")` → TikTok incompatível, logo nada publica (asserção sobre `incompativeis.length > 0`).
4. `extrairIdentificadorMidiaDoTurno("publique a mídia ID 727711F0")` → resolve o código curto (caminho da biblioteca); `"o pedido a1b2c3d4 saiu"` → não resolve.

Para o caso 4, `extrairIdentificadorMidiaDoTurno` (linha 3610) é movida para `post-guardas.ts` e importada no processador — sem duplicar lógica.

---

## Respostas diretas

- **Não altero a linha 3167** (barreira de vínculo de mídia). Ela continua exigindo UUID + tipo.
- **Não relaxo nada** para o post passar: o catálogo passa a falhar mais, não menos.
- **Compatibilidade de tipo deixa de ser por rede na hora da API** e passa a ser global antes da primeira chamada.
- Os posts já publicados no Facebook, Instagram e LinkedIn **não são apagados por este plano** — me autorize e eu removo em seguida, é uma ação destrutiva em conta externa.
