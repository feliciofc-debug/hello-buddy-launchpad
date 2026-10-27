import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyGestaoIntent } from "./gestao-intent-pt.ts";
import { classifyOwnerMediaIntent } from "./owner-media-intent.ts";
import {
  buscarJarvisAjudaCatalogo,
  formatarMenuJarvisAjuda,
  JARVIS_AJUDA_CATALOGO,
  JARVIS_AJUDA_SECOES,
} from "./jarvis-ajuda-catalogo.ts";

Deno.test("AJUDA-1 — todas as frases gestao_intent acionam o kind prometido", () => {
  for (const item of JARVIS_AJUDA_CATALOGO) {
    if (item.rota.tipo !== "gestao_intent") continue;
    for (const frase of item.comoPedir) {
      assertEquals(
        classifyGestaoIntent(frase).kind,
        item.rota.kind,
        `${item.id}: “${frase}”`,
      );
    }
  }
});

Deno.test("AJUDA-1 — todas as frases owner_media acionam o classificador real", () => {
  for (const item of JARVIS_AJUDA_CATALOGO) {
    if (item.rota.tipo !== "owner_media") continue;
    for (const frase of item.comoPedir) {
      assertEquals(
        classifyOwnerMediaIntent(frase).action,
        item.rota.action,
        `${item.id}: “${frase}”`,
      );
    }
  }
});

Deno.test("AJUDA-1 — cada llm_tool consta na lista real de tools do dono", async () => {
  const processor = await Deno.readTextFile(
    new URL(
      "../whatsapp-cloud-inbound-processor/index.ts",
      import.meta.url,
    ),
  );
  for (const item of JARVIS_AJUDA_CATALOGO) {
    if (item.rota.tipo !== "llm_tool") continue;
    assert(
      processor.includes(`name: "${item.rota.nome}"`),
      `${item.id}: tool ${item.rota.nome} não existe no processor`,
    );
  }
});

Deno.test("AJUDA-1 — estoque de revenda usa o estoque de veículos", async () => {
  const processor = await Deno.readTextFile(
    new URL(
      "../whatsapp-cloud-inbound-processor/index.ts",
      import.meta.url,
    ),
  );
  assertStringIncludes(processor, "if (gate.usesVehicleStock)");
  assertStringIncludes(
    processor,
    "return toolConsultarEstoqueVeiculos(q, sb, ctx.userId)",
  );
});

Deno.test("AJUDA-1 — catálogo cobre as nove seções e painel informa caminho", () => {
  for (const secao of JARVIS_AJUDA_SECOES) {
    assert(
      JARVIS_AJUDA_CATALOGO.some((item) => item.secao === secao),
      `seção vazia: ${secao}`,
    );
  }
  for (const item of JARVIS_AJUDA_CATALOGO) {
    assert(item.comoPedir.length >= 2 && item.comoPedir.length <= 3);
    assertEquals(item.oQueAcontece.includes("\n"), false);
    if (item.rota.tipo === "painel") {
      assert(item.rota.caminho.length > 3);
      assert(
        item.comoPedir.every((frase) =>
          /painel|gestão|veículo|os/i.test(frase)
        ),
      );
    }
  }
});

Deno.test("AJUDA-1 — busca local encontra pedido e menu lista seções", () => {
  assertEquals(
    buscarJarvisAjudaCatalogo("como faço para emitir nota?")?.id,
    "nfe-emitir",
  );
  assertEquals(
    buscarJarvisAjudaCatalogo("como eu peço o fechamento?")?.id,
    "fechamento",
  );
  const menu = formatarMenuJarvisAjuda();
  assertStringIncludes(menu, "Estoque e veículos");
  assertStringIncludes(menu, "Notas fiscais e contratos");
});

Deno.test("AJUDA-1 — gestor não vê Marketing", () => {
  const menu = formatarMenuJarvisAjuda("gestor");
  assertEquals(menu.includes("Anúncios e redes"), false);
  assertEquals(
    buscarJarvisAjudaCatalogo(
      "como faço para publicar uma foto no Instagram?",
      "gestor",
    ),
    null,
  );
});
