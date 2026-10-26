import type { WebmotorsAnuncioSnBooleans } from "./webmotors-anuncio-sn.ts";
import { webmotorsAnuncioSnFromBooleans } from "./webmotors-anuncio-sn.ts";
import type { WmAnuncioPayload, WmCatalogItem } from "./webmotors-car-api.ts";
import {
  normalizeCatalogLabel,
  webmotorsPublicObservacao,
} from "./webmotors-text.ts";
import type {
  VeiculoEstoqueRow,
  WebmotorsVeiculoMapRow,
  WmBlockingItem,
  WmMapResult,
} from "./webmotors-vehicle-types.ts";

function pickByLabel(
  label: string | null | undefined,
  items: WmCatalogItem[],
  field: string,
  blocking: WmBlockingItem[],
): number | null {
  if (!label?.trim()) return null;
  const want = normalizeCatalogLabel(label);
  const exact = items.find((i) => normalizeCatalogLabel(i.nome) === want);
  if (exact) return exact.codigo;
  blocking.push({
    field,
    message:
      `Não encontramos "${label}" no catálogo Webmotors. Ajuste o de/para.`,
    allowed: items.slice(0, 30).map((i) => i.nome),
  });
  return null;
}

function pickPortas(
  portas: number | null,
  options: number[],
  blocking: WmBlockingItem[],
): number | null {
  if (portas != null && options.includes(portas)) return portas;
  if (portas != null) {
    const near = options.find((p) => p === portas);
    if (near) return near;
    blocking.push({
      field: "portas",
      message: `Número de portas (${portas}) não existe na Webmotors.`,
      allowed: options.map(String),
    });
    return null;
  }
  blocking.push({
    field: "portas",
    message: "Informe o número de portas do veículo.",
  });
  return null;
}

export type WmCatalogBundle = {
  marcas: WmCatalogItem[];
  modelos: WmCatalogItem[];
  versoes: WmCatalogItem[];
  cores: WmCatalogItem[];
  combustiveis: WmCatalogItem[];
  cambios: WmCatalogItem[];
  portas: number[];
  modalidades: WmCatalogItem[];
  opcionais: WmCatalogItem[];
};

/** Placa para conferência Webmotors (não exibida no anúncio). */
export function normalizeWebmotorsPlaca(
  raw: string | null | undefined,
): string | null {
  const n = String(raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return n.length >= 7 ? n : null;
}

/**
 * PrecoVenda = preço anunciado (estoque AMZ).
 * PrecoReal = 0 ou preço promocional "de" (maior que PrecoVenda). Igual ao de venda é recusado (22|78).
 */
export function webmotorsPricesFromEstoque(
  preco: number | null,
  precoDe?: number | null,
): { precoVenda: number; precoReal: number } | null {
  if (preco == null || !Number.isFinite(Number(preco)) || Number(preco) <= 0) {
    return null;
  }
  const precoVenda = Math.round(Number(preco) * 100) / 100;
  let precoReal = 0;
  if (precoDe != null && Number.isFinite(Number(precoDe))) {
    const de = Math.round(Number(precoDe) * 100) / 100;
    if (de > precoVenda) precoReal = de;
  }
  return { precoVenda, precoReal };
}

export function mapVehicleToWebmotorsCar(input: {
  vehicle: VeiculoEstoqueRow;
  manualMap: WebmotorsVeiculoMapRow | null;
  catalog: WmCatalogBundle;
  defaultModalidade: number | null;
  existingCodigoAnuncio?: number;
  anuncioSn?: WebmotorsAnuncioSnBooleans;
}): WmMapResult {
  const blocking: WmBlockingItem[] = [];
  const v = input.vehicle;
  const m = input.manualMap;

  const marcaCod = m?.codigo_marca ??
    pickByLabel(v.marca, input.catalog.marcas, "marca", blocking);
  const modeloCod = m?.codigo_modelo ??
    (marcaCod != null
      ? pickByLabel(v.modelo, input.catalog.modelos, "modelo", blocking)
      : null);
  const versaoCod = m?.codigo_versao ??
    pickByLabel(v.versao, input.catalog.versoes, "versao", blocking);
  const corCod = m?.codigo_cor ??
    pickByLabel(v.cor, input.catalog.cores, "cor", blocking);
  const combCod = m?.codigo_combustivel ??
    pickByLabel(
      v.combustivel,
      input.catalog.combustiveis,
      "combustivel",
      blocking,
    );
  const cambCod = m?.codigo_cambio ??
    pickByLabel(v.cambio, input.catalog.cambios, "cambio", blocking);
  const portas = m?.nr_portas ??
    pickPortas(v.portas, input.catalog.portas, blocking);

  let modalidade = m?.codigo_modalidade ?? input.defaultModalidade;
  if (modalidade == null && input.catalog.modalidades.length === 1) {
    modalidade = input.catalog.modalidades[0].codigo;
  }
  if (modalidade == null) {
    blocking.push({
      field: "modalidade",
      message: "Escolha a modalidade de anúncio Webmotors (pacote da loja).",
      allowed: input.catalog.modalidades.map((x) => x.nome),
    });
  }

  const placa = normalizeWebmotorsPlaca(v.placa);
  if (!placa) {
    blocking.push({
      field: "placa",
      message:
        "Cadastre a placa do veículo para publicar na Webmotors.",
    });
  }

  const prices = webmotorsPricesFromEstoque(v.preco, v.preco_de);
  if (!prices) {
    blocking.push({ field: "preco", message: "Informe o preço do veículo." });
  }

  const fotos = (v.fotos ?? []).filter(Boolean);
  if (!fotos.length) {
    blocking.push({
      field: "fotos",
      message: "Adicione ao menos uma foto pública.",
    });
  }

  const anoFab = v.ano_fabricacao ?? v.ano_modelo;
  const anoMod = v.ano_modelo ?? v.ano_fabricacao;
  if (!anoFab || !anoMod) {
    blocking.push({
      field: "ano",
      message: "Informe ano de fabricação e ano modelo.",
    });
  }

  let observacao = "";
  try {
    observacao = webmotorsPublicObservacao(v.descricao);
  } catch (e) {
    blocking.push({ field: "descricao", message: (e as Error).message });
  }

  if (
    blocking.length ||
    marcaCod == null ||
    modeloCod == null ||
    versaoCod == null ||
    corCod == null ||
    combCod == null ||
    cambCod == null ||
    portas == null ||
    modalidade == null ||
    !prices ||
    !placa ||
    !anoFab ||
    !anoMod
  ) {
    return { ok: false, blocking };
  }

  const sn = webmotorsAnuncioSnFromBooleans(input.anuncioSn);

  const opcionais: number[] = m?.opcionais?.length
    ? m.opcionais
    : (v.opcionais ?? []).map((op) => {
      const want = normalizeCatalogLabel(op);
      const hit = input.catalog.opcionais.find((i) =>
        normalizeCatalogLabel(i.nome) === want
      );
      return hit?.codigo ?? null;
    }).filter((c): c is number => c != null);

  const payload: WmAnuncioPayload = {
    CodigoAnuncio: input.existingCodigoAnuncio ?? 0,
    CodigoModalidade: modalidade,
    TipoAnuncio: "U",
    CodigoMarca: marcaCod,
    CodigoModelo: modeloCod,
    CodigoVersao: versaoCod,
    AnoDoModelo: anoMod,
    AnoFabricacao: anoFab,
    Km: v.km ?? 0,
    Placa: placa,
    CodigoCambio: cambCod,
    NrPortas: portas,
    CodigoCor: corCod,
    CodigoCombustivel: combCod,
    Blindado: v.blindado ? "S" : "N",
    AdaptadoDeficientesFisicos: sn.AdaptadoDeficientesFisicos,
    UnicoDono: sn.UnicoDono,
    Alienado: sn.Alienado,
    IpvaPago: sn.IpvaPago,
    NaoAceitaTroca: sn.NaoAceitaTroca,
    RevisadoOficinaAgendaDoCarro: sn.RevisadoOficinaAgendaDoCarro,
    RevisoesEmConcessionaria: sn.RevisoesEmConcessionaria,
    GarantiaDeFabrica: sn.GarantiaDeFabrica,
    Licenciado: sn.Licenciado,
    Leilao: sn.Leilao,
    PrecoReal: prices.precoReal,
    PrecoVenda: prices.precoVenda,
    Observacao: observacao,
    OpcionalCodigos: opcionais,
  };

  return { ok: true, payload };
}

/** Garante que o payload não carrega campos internos além de Observacao saneada. */
export function assertWebmotorsPayloadPublicOnly(
  payload: WmAnuncioPayload,
): void {
  webmotorsPublicObservacao(payload.Observacao);
}
