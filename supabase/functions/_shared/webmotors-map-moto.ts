import type { WmCatalogItem } from "./webmotors-car-api.ts";
import {
  parseAnoMotoFromModeloBlock,
  type WmMotoAnuncioPayload,
} from "./webmotors-moto-api.ts";
import {
  normalizeCatalogLabel,
  webmotorsPublicObservacao,
} from "./webmotors-text.ts";
import { webmotorsPricesFromEstoque } from "./webmotors-map-car.ts";
import type {
  VeiculoEstoqueRow,
  WebmotorsVeiculoMapRow,
  WmBlockingItem,
  WmMotoMapResult,
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
      `Não encontramos "${label}" no catálogo Webmotors (motos). Ajuste o de/para.`,
    allowed: items.slice(0, 30).map((i) => i.nome),
  });
  return null;
}

export type WmMotoCatalogBundle = {
  marcas: WmCatalogItem[];
  modelos: Array<WmCatalogItem & { estilo?: string | null; anosXml?: string }>;
  cores: WmCatalogItem[];
  modalidades: WmCatalogItem[];
};

export function mapVehicleToWebmotorsMoto(input: {
  vehicle: VeiculoEstoqueRow;
  manualMap: WebmotorsVeiculoMapRow | null;
  catalog: WmMotoCatalogBundle;
  defaultModalidade: number | null;
  existingCodigoAnuncio?: number;
}): WmMotoMapResult {
  const blocking: WmBlockingItem[] = [];
  const v = input.vehicle;
  const m = input.manualMap;

  const marcaCod = m?.codigo_marca ??
    pickByLabel(v.marca, input.catalog.marcas, "marca", blocking);
  const modeloEntry = input.catalog.modelos.find((x) =>
    m?.codigo_modelo
      ? x.codigo === Number(m.codigo_modelo)
      : normalizeCatalogLabel(x.nome) === normalizeCatalogLabel(v.modelo)
  );
  const modeloCod = m?.codigo_modelo ?? modeloEntry?.codigo ?? null;
  if (!modeloCod) {
    blocking.push({
      field: "modelo",
      message: "Modelo de moto não encontrado no catálogo Webmotors.",
    });
  }

  const anoModelo = v.ano_modelo ?? v.ano_fabricacao;
  const anoFab = v.ano_fabricacao ?? v.ano_modelo;
  if (anoModelo == null || anoFab == null) {
    blocking.push({
      field: "ano_modelo",
      message: "Informe ano do modelo e fabricação.",
    });
  }

  const anoSpecs = modeloEntry?.anosXml
    ? parseAnoMotoFromModeloBlock(modeloEntry.anosXml, Number(anoModelo))
    : null;
  if (!anoSpecs) {
    blocking.push({
      field: "ano_modelo",
      message: "Ano não disponível para este modelo na Webmotors.",
    });
  }

  const corCod = m?.codigo_cor ??
    pickByLabel(v.cor, input.catalog.cores, "cor", blocking);
  const modalidade = m?.codigo_modalidade ?? input.defaultModalidade ??
    (input.catalog.modalidades.length === 1
      ? input.catalog.modalidades[0].codigo
      : null);
  if (!modalidade) {
    blocking.push({
      field: "modalidade",
      message: "Escolha a modalidade de anúncio Webmotors.",
      allowed: input.catalog.modalidades.map((item) => item.nome),
    });
  }

  const prices = webmotorsPricesFromEstoque(v.preco);
  if (!prices) {
    blocking.push({ field: "preco", message: "Informe o preço da moto." });
  }

  if (
    blocking.length || !marcaCod || !modeloCod || !corCod || !modalidade ||
    !anoSpecs || !prices
  ) {
    return { ok: false, blocking };
  }

  const cil = v.cilindrada_cc && v.cilindrada_cc > 0
    ? v.cilindrada_cc
    : (m?.numero_cilindradas ?? null);
  if (!cil) {
    blocking.push({
      field: "cilindrada_cc",
      message: "Informe a cilindrada (cc) da moto.",
    });
    return { ok: false, blocking };
  }

  const payload: WmMotoAnuncioPayload = {
    CodigoAnuncio: input.existingCodigoAnuncio ?? 0,
    CodigoMarca: Number(marcaCod),
    CodigoModelo: Number(modeloCod),
    AnoDoModelo: Number(anoModelo),
    AnoFabricacao: Number(anoFab),
    CodigoCorPredominante: Number(corCod),
    CodigoCorSecundaria: Number(m?.codigo_cor_secundaria ?? corCod),
    CodigoNumeroMarchas: Number(
      m?.codigo_numero_marchas ?? anoSpecs.NumeroMarchas,
    ),
    CodigoTipoRefrigeracao: Number(
      m?.codigo_tipo_refrigeracao ?? anoSpecs.TipoRefrigeracao,
    ),
    CodigoTipoAlimentacao: Number(
      m?.codigo_tipo_alimentacao ?? anoSpecs.TipoAlimentacao,
    ),
    CodigoTipoMotor: Number(m?.codigo_tipo_motor ?? anoSpecs.TipoMotor),
    CodigoTipoPartida: Number(m?.codigo_tipo_partida ?? anoSpecs.TipoPartida),
    CodigoTipoFreio: Number(m?.codigo_tipo_freio ?? anoSpecs.TipoFreio),
    NumeroCilindradas: Number(cil),
    CodigoModalidade: Number(modalidade),
    PrecoRevenda: prices.precoReal,
    PrecoVenda: prices.precoVenda,
    Km: String(v.km ?? 0),
    Observacao: webmotorsPublicObservacao(v.descricao),
    TipoAnuncio: "U",
    CodigoSMS: Number(m?.codigo_sms ?? 0),
    TipoConsistencia: Number(m?.tipo_consistencia ?? 0),
    EstiloMoto: v.estilo_moto ?? modeloEntry?.estilo ?? undefined,
  };

  return { ok: true, payload };
}

export function assertWebmotorsMotoPayloadPublicOnly(
  _payload: WmMotoAnuncioPayload,
): void {
  /* mesma regra de Observacao pública — validada em webmotorsPublicObservacao */
}
