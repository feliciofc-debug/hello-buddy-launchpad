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
import {
  OS_COTACAO_SESSAO_TTL_MS,
  deveCapturarMensagemCotacao,
  sessaoCotacaoEstaAtiva,
  textoCancelaSessaoCotacao,
  textoPareceOrcamentoForte,
} from "./os-parceiro-gate.ts";
import { classificarDocumentoIdentidade } from "./documento-detector.ts";

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

Deno.test("COTACAO-WPP-1.1 — conversa comum do parceiro não entra na cotação", () => {
  assertEquals(textoPareceOrcamentoForte("bom dia"), false);
  assertEquals(textoPareceOrcamentoForte("tem Onix 2020?"), false);
  assertEquals(deveCapturarMensagemCotacao({
    interactive: false,
    sessaoAtiva: false,
    texto: "bom dia",
    documentoOuImagem: false,
  }), false);
  assertEquals(deveCapturarMensagemCotacao({
    interactive: false,
    sessaoAtiva: false,
    texto: "tem Onix 2020?",
    documentoOuImagem: false,
  }), false);
});

Deno.test("COTACAO-WPP-1.1 — só padrões fortes iniciam orçamento por texto", () => {
  assertEquals(textoPareceOrcamentoForte("1950, 7 dias"), true);
  assertEquals(textoPareceOrcamentoForte("R$ 1.950"), true);
  assertEquals(textoPareceOrcamentoForte("fica 1950 reais"), true);
  assertEquals(textoPareceOrcamentoForte("2020"), false);
  assertEquals(deveCapturarMensagemCotacao({
    interactive: false,
    sessaoAtiva: false,
    texto: "1950, 7 dias",
    documentoOuImagem: false,
  }), true);
});

Deno.test("COTACAO-WPP-1.1 — sessão expira em duas horas e pode ser cancelada", () => {
  const now = Date.parse("2026-10-25T20:00:00Z");
  assertEquals(
    sessaoCotacaoEstaAtiva({
      fase: "valor",
      updated_at: new Date(now - OS_COTACAO_SESSAO_TTL_MS + 1).toISOString(),
    }, now),
    true,
  );
  assertEquals(
    sessaoCotacaoEstaAtiva({
      fase: "prazo",
      updated_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    }, now),
    false,
  );
  assertEquals(textoCancelaSessaoCotacao("cancelar"), true);
  assertEquals(textoCancelaSessaoCotacao("sair"), true);
  assertEquals(deveCapturarMensagemCotacao({
    interactive: true,
    sessaoAtiva: false,
    texto: "",
    documentoOuImagem: false,
  }), true);
  assertEquals(deveCapturarMensagemCotacao({
    interactive: false,
    sessaoAtiva: false,
    texto: "",
    documentoOuImagem: true,
  }), true);
});

Deno.test("COTACAO-WPP-1 — IDs interativos os_cot_wa", () => {
  assertEquals(OS_COT_WA_BTN_ENVIAR, "os_cot_wa:enviar_orcamento");
  assertEquals(
    parseOsCotacaoWaInteractiveId("Ok\n<<INTERACTIVE_ID:os_cot_wa:enviar_orcamento>>"),
    "enviar_orcamento",
  );
  assertEquals(osCotacaoWaInteractiveId("confirmar_sim"), "os_cot_wa:confirmar_sim");
});

Deno.test("COTACAO-WPP-1.1 — mídia exige Sim ou Não, outro assunto", async () => {
  const inbound = await Deno.readTextFile(new URL(
    "./os-parceiro-inbound.ts",
    import.meta.url,
  ));
  assertStringIncludes(inbound, 'fase: "confirmar_midia"');
  assertStringIncludes(inbound, "Isso é o orçamento da OS #");
  assertStringIncludes(inbound, "OS_COT_WA_BTN_OUTRO_ASSUNTO");
  assertStringIncludes(inbound, "confirmarOrcamentoParceiroDocumento");
});

Deno.test("DOC-0.1 — orçamento de parceiro não cai no cofre antes da cotação", async () => {
  const budget =
    "ORCAMENTO FUNILARIA DO ZE CNPJ 04.252.011/0001-10 TELEFONE 11 98765-4321 TOTAL R$ 3.800,00";
  assertEquals(classificarDocumentoIdentidade(budget), {
    documento: false,
    tipo: null,
  });
  const inbound = await Deno.readTextFile(new URL(
    "./os-parceiro-inbound.ts",
    import.meta.url,
  ));
  assertEquals(
    inbound.indexOf("isProtectedDocument") <
      inbound.indexOf("textoDeOrcamentoParceiroMedia(doc)"),
    true,
  );
  assertStringIncludes(inbound, "Isso é o orçamento da OS #");
  assertStringIncludes(inbound, "mediaConfirmButtons");
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
  assertStringIncludes(sql, "dica_enviada_em");
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
