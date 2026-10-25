import {
  assertEquals,
  assertThrows,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildGestaoOsCotacaoPdfLines,
  gestaoOsPdfContemCustosInternos,
  podeAbrirOsGestao,
  podeEscolherCotacaoOs,
  simularEscolhaCotacao,
} from "./gestao-os-cotacao-pdf.ts";
import {
  gestaoOsFotosParaPdf,
  gestaoOsFotosVisiveis,
  gestaoOsOrdenarFotosDefeitoPrimeiro,
} from "./gestao-os-fotos.ts";
import { GESTAO_TROCA_FOTO_ETIQUETA_CRLV } from "./gestao-troca-fotos.ts";

Deno.test("OS-1.3 — laudo na OS sem valores estimados (migration)", async () => {
  const sql = await Deno.readTextFile(new URL(
    "../../migrations/20261032263000_gestao_os_cotacao.sql",
    import.meta.url,
  ));
  assertStringIncludes(sql, "0,");
  assertStringIncludes(sql, "gestao_os_cotacao");
  assertStringIncludes(sql, "gestao_os_foto_ref");
  assertStringIncludes(sql, "gestao_os_foto_ref_crlv");
  assertEquals(sql.includes("preparacao_estimada"), false);
});

Deno.test("OS-1.3 — escolher cotação define parceiro e descarta demais", () => {
  const osId = "os-1";
  const cotacoes = [
    { id: "c1", os_id: osId, parceiro_id: "p1", valor: 2400, prazo_dias: 5, status: "recebida" as const },
    { id: "c2", os_id: osId, parceiro_id: "p2", valor: 1950, prazo_dias: 7, status: "recebida" as const },
    { id: "c3", os_id: osId, parceiro_id: "p3", valor: 3100, prazo_dias: 3, status: "recebida" as const },
  ];
  const r = simularEscolhaCotacao(cotacoes, "c2", osId);
  assertEquals(r.parceiroId, "p2");
  assertEquals(r.valorAprovado, 1950);
  assertEquals(r.cotacoes.find((c) => c.id === "c2")?.status, "escolhida");
  assertEquals(r.cotacoes.filter((c) => c.status === "descartada").length, 2);
});

Deno.test("OS-1.3 — não escolhe cotação de outra OS", () => {
  assertThrows(
    () => simularEscolhaCotacao(
      [{ id: "c1", os_id: "outra", parceiro_id: "p1", valor: 100, prazo_dias: 1, status: "recebida" }],
      "c1",
      "os-1",
    ),
    Error,
    "não pertence",
  );
});

Deno.test("OS-1.3 — CRLV nunca listado nas fotos da OS", () => {
  const refs = [
    { id: "1", storage_path: "u/t/a.jpg", selecionada: true, ordem: 1, troca_ia_item_id: "item" },
    { id: "2", storage_path: "u/t/crlv.pdf", selecionada: true, ordem: 2, troca_ia_item_id: null },
  ];
  const visiveis = gestaoOsFotosVisiveis(refs, [
    { path: "u/t/a.jpg", etiqueta: "Lateral esquerda" },
    { path: "u/t/crlv.pdf", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_CRLV },
  ]);
  assertEquals(visiveis.length, 1);
  assertEquals(visiveis[0].storage_path, "u/t/a.jpg");
});

Deno.test("OS-1.3 — fotos de defeito do laudo primeiro", () => {
  const ordenadas = gestaoOsOrdenarFotosDefeitoPrimeiro([
    { id: "a", storage_path: "x/a", selecionada: false, ordem: 2, troca_ia_item_id: null },
    { id: "b", storage_path: "x/b", selecionada: true, ordem: 1, troca_ia_item_id: "ia" },
  ]);
  assertEquals(ordenadas[0].id, "b");
});

Deno.test("OS-1.3 — PDF de cotação sem custos internos", () => {
  const linhas = buildGestaoOsCotacaoPdfLines({
    titulo: "pedido_cotacao",
    lojaNome: "Auto Center",
    parceiroNome: "Funilaria do Zé",
    osNumero: 42,
    dataIso: "2026-10-25T12:00:00Z",
    veiculo: { marca: "Toyota", modelo: "Corolla", placa: "ABC1D23" },
    itens: [{ descricao: "Amassado na porta traseira esquerda" }],
  });
  assertEquals(gestaoOsPdfContemCustosInternos(linhas), false);
  assertStringIncludes(linhas.join("\n"), "Amassado");
  assertEquals(linhas.some((l) => l.includes("R$") && l.toLowerCase().includes("margem")), false);
});

Deno.test("OS-1.3 — abrir OS sem parceiro cadastrado bloqueado", () => {
  assertEquals(podeAbrirOsGestao(0), false);
  assertEquals(podeAbrirOsGestao(2), true);
});

Deno.test("OS-1.4 — escolher cotação bloqueado após aprovação ou execução", () => {
  assertEquals(podeEscolherCotacaoOs("orcamento"), { ok: true });
  assertEquals(podeEscolherCotacaoOs("aprovada").ok, false);
  assertEquals(podeEscolherCotacaoOs("em_execucao").ok, false);
  assertThrows(
    () => simularEscolhaCotacao(
      [{ id: "c1", os_id: "os-1", parceiro_id: "p1", valor: 100, prazo_dias: 1, status: "recebida" }],
      "c1",
      "os-1",
      "aprovada",
    ),
    Error,
    "já foi aprovada",
  );
});

Deno.test("OS-1.4 — migration trava grants, trigger CRLV e RPC escolher", async () => {
  const sql = await Deno.readTextFile(new URL(
    "../../migrations/20261032263000_gestao_os_cotacao.sql",
    import.meta.url,
  ));
  assertStringIncludes(sql, "GRANT UPDATE (observacao) ON public.gestao_os_cotacao");
  assertStringIncludes(sql, "GRANT UPDATE (selecionada, ordem) ON public.gestao_os_foto_ref");
  assertEquals(sql.includes("GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_os_foto_ref TO authenticated"), false);
  assertStringIncludes(sql, "gestao_os_foto_ref_bloqueia_crlv");
  assertStringIncludes(sql, "gestao_os_cotacao_bloqueia_update_direto");
  assertStringIncludes(sql, "A OS já foi aprovada; para trocar de fornecedor");
});

Deno.test("OS-1.4 — PDF ignora CRLV mesmo se selecionada", () => {
  const refs = gestaoOsFotosParaPdf([
    { id: "1", storage_path: "u/t/a.jpg", selecionada: true, ordem: 1, troca_ia_item_id: null },
    { id: "2", storage_path: "u/t/doc.jpg", selecionada: true, ordem: 2, troca_ia_item_id: null },
  ], [
    { path: "u/t/a.jpg", etiqueta: "Traseira" },
    { path: "u/t/doc.jpg", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_CRLV },
  ]);
  assertEquals(refs.length, 1);
  assertEquals(refs[0].storage_path, "u/t/a.jpg");
});
