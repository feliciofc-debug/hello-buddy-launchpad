import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseOrcamentoParceiroTexto } from "./os-parceiro-parser.ts";
import {
  deveIgnorarFluxoParceiro,
  parceiroMatchesPhone,
} from "./os-parceiro-routing.ts";
import {
  OS_COT_WA_BTN_ENVIAR,
  osCotacaoWaInteractiveId,
  parseOsCotacaoWaInteractiveId,
} from "./os-parceiro-interactive.ts";
import { gestaoOsPdfContemCustosInternos, buildGestaoOsCotacaoPdfLines } from "./gestao-os-cotacao-pdf.ts";
import { gestaoOsFotosParaPdf } from "./gestao-os-fotos.ts";
import { GESTAO_TROCA_FOTO_ETIQUETA_CRLV } from "./gestao-troca-fotos.ts";

Deno.test("COTACAO-WPP-1 — roteamento: dono/gestor ignoram fluxo parceiro", () => {
  const auth = {
    ownerPhone: "5511999990001",
    ownerAltPhones: [],
    gestores: ["5511888880002"],
  };
  assertEquals(deveIgnorarFluxoParceiro("5511999990001", auth, true), true);
  assertEquals(deveIgnorarFluxoParceiro("5511888880002", auth, false), true);
  assertEquals(deveIgnorarFluxoParceiro("5511777770003", auth, false), false);
});

Deno.test("COTACAO-WPP-1 — parceiro identificado pelo whatsapp_e164", () => {
  assertEquals(
    parceiroMatchesPhone(
      { id: "p1", user_id: "u", nome: "Zé", whatsapp_e164: "+55 11 97777-0001", ativo: true },
      "5511977770001",
    ),
    true,
  );
  assertEquals(
    parceiroMatchesPhone(
      { id: "p1", user_id: "u", nome: "Zé", whatsapp_e164: "+55 11 97777-0001", ativo: true },
      "5511999990001",
    ),
    false,
  );
});

Deno.test("COTACAO-WPP-1 — parser texto livre valor e prazo", () => {
  const p = parseOrcamentoParceiroTexto("R$ 1.950,00 · 7 dias");
  assertEquals(p.valor, 1950);
  assertEquals(p.prazoDias, 7);
  const audio = parseOrcamentoParceiroTexto("🎙️ Áudio transcrito: 1950, 7 dias");
  assertEquals(audio.valor, 1950);
  assertEquals(audio.prazoDias, 7);
});

Deno.test("COTACAO-WPP-1 — IDs interativos os_cot_wa", () => {
  assertEquals(OS_COT_WA_BTN_ENVIAR, "os_cot_wa:enviar_orcamento");
  assertEquals(
    parseOsCotacaoWaInteractiveId("Ok\n<<INTERACTIVE_ID:os_cot_wa:enviar_orcamento>>"),
    "enviar_orcamento",
  );
  assertEquals(osCotacaoWaInteractiveId("confirmar_sim"), "os_cot_wa:confirmar_sim");
});

Deno.test("COTACAO-WPP-1 — PDF pedido sem custos internos e sem CRLV", () => {
  const linhas = buildGestaoOsCotacaoPdfLines({
    titulo: "pedido_cotacao",
    lojaNome: "Loja",
    parceiroNome: "Parceiro",
    osNumero: 1,
    dataIso: "2026-10-25T00:00:00Z",
    veiculo: { marca: "X", modelo: "Y" },
    itens: [{ descricao: "Funilaria porta" }],
  });
  assertEquals(gestaoOsPdfContemCustosInternos(linhas), false);
  const fotos = gestaoOsFotosParaPdf(
    [{ id: "1", storage_path: "u/t/crlv.jpg", selecionada: true, ordem: 1, troca_ia_item_id: null }],
    [{ path: "u/t/crlv.jpg", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_CRLV }],
  );
  assertEquals(fotos.length, 0);
});

Deno.test("COTACAO-WPP-1 — migration whatsapp e status recusada", async () => {
  const sql = await Deno.readTextFile(new URL(
    "../../migrations/20261032264000_gestao_os_cotacao_whatsapp.sql",
    import.meta.url,
  ));
  assertStringIncludes(sql, "'recusada'");
  assertStringIncludes(sql, "whatsapp_parceiro");
  assertStringIncludes(sql, "gestao_os_cotacao_wa_sessao");
});

Deno.test("COTACAO-WPP-1 — módulo mídia orçamento parceiro", async () => {
  const src = await Deno.readTextFile(new URL(
    "./os-parceiro-orcamento-media.ts",
    import.meta.url,
  ));
  assertStringIncludes(src, "tipo: \"orcamento\"");
  assertStringIncludes(src, "textoDeOrcamentoParceiroMedia");
});

Deno.test("COTACAO-WPP-1 — template send aceita document_url", async () => {
  const src = await Deno.readTextFile(new URL(
    "../whatsapp-cloud-send-template/index.ts",
    import.meta.url,
  ));
  assertStringIncludes(src, "document_url");
});

Deno.test("COTACAO-WPP-1 — processor gancho documentado", async () => {
  const src = await Deno.readTextFile(new URL(
    "../whatsapp-cloud-inbound-processor/index.ts",
    import.meta.url,
  ));
  assertStringIncludes(src, "COTACAO-WPP-1");
  assertStringIncludes(src, "tryProcessOsParceiroCotacaoWhatsAppShortcut");
  assertStringIncludes(src, "os_cotacao_parceiro_wa");
});
