import {
  type WebmotorsAmbiente,
  webmotorsEndpoint,
  WM_CODIGOS_MOTOS_NS,
  WM_ESTOQUE_MOTOS_NS,
} from "./webmotors-endpoints.ts";
import {
  escapeXml,
  parseSoapFault,
  soapPost,
  xmlAllBlocks,
  xmlFirstText,
} from "./webmotors-soap-client.ts";
import {
  isWebmotorsSuccess,
  webmotorsCodigoRetornoMessage,
} from "./webmotors-errors.ts";
import type { WmCatalogItem } from "./webmotors-car-api.ts";

function parseCatalogItems(
  xml: string,
  blockTag: string,
  codigoTag: string,
  nomeTag: string,
): WmCatalogItem[] {
  const blocks = xmlAllBlocks(xml, blockTag);
  const out: WmCatalogItem[] = [];
  for (const b of blocks) {
    const codigoRaw = xmlFirstText(b, codigoTag);
    const nome = xmlFirstText(b, nomeTag) ?? "";
    if (!codigoRaw) continue;
    const codigo = Number(codigoRaw);
    if (!Number.isFinite(codigo)) continue;
    out.push({ codigo, nome: nome.trim() });
  }
  return out;
}

function assertSoapOk(xml: string): void {
  const fault = parseSoapFault(xml);
  if (fault) throw new Error("Erro ao consultar a Webmotors. Tente novamente.");
  const codigo = xmlFirstText(xml, "CodigoRetorno");
  if (codigo && !isWebmotorsSuccess(codigo)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigo));
  }
}

async function codigosCall(
  ambiente: WebmotorsAmbiente,
  hash: string,
  operation: string,
  innerParams: string,
): Promise<string> {
  const url = webmotorsEndpoint(ambiente, "codigos_motos");
  const body = `<${operation} xmlns="${WM_CODIGOS_MOTOS_NS}">` +
    `<hashAutenticacao>${escapeXml(hash)}</hashAutenticacao>` +
    innerParams +
    `</${operation}>`;
  return await soapPost({
    url,
    soapAction: `${WM_CODIGOS_MOTOS_NS}/${operation}`,
    bodyXml: body,
  });
}

async function estoqueMotosCall(
  ambiente: WebmotorsAmbiente,
  hash: string,
  operation: string,
  innerParams: string,
): Promise<string> {
  const url = webmotorsEndpoint(ambiente, "estoque_motos");
  const body = `<${operation} xmlns="${WM_ESTOQUE_MOTOS_NS}">` +
    `<hashAutenticacao>${escapeXml(hash)}</hashAutenticacao>` +
    innerParams +
    `</${operation}>`;
  return await soapPost({
    url,
    soapAction: `${WM_ESTOQUE_MOTOS_NS}/${operation}`,
    bodyXml: body,
  });
}

export async function wmObterMarcaMotos(
  ambiente: WebmotorsAmbiente,
  hash: string,
): Promise<WmCatalogItem[]> {
  const xml = await codigosCall(ambiente, hash, "obterMarcaMotos", "");
  assertSoapOk(xml);
  return parseCatalogItems(xml, "MarcaMotoWM", "CodigoMarca", "NomeMarca");
}

export async function wmObterModeloMotos(
  ambiente: WebmotorsAmbiente,
  hash: string,
  codigoMarca: number,
): Promise<
  Array<WmCatalogItem & { estilo?: string | null; anosXml?: string }>
> {
  const end = new Date();
  const start = new Date("2000-01-01T00:00:00");
  const xml = await codigosCall(
    ambiente,
    hash,
    "obterModeloMotos",
    `<codigoMarca>${codigoMarca}</codigoMarca>` +
      `<dataInicioAtualizacao>${start.toISOString()}</dataInicioAtualizacao>` +
      `<dataFinalAtualizacao>${end.toISOString()}</dataFinalAtualizacao>`,
  );
  assertSoapOk(xml);
  const blocks = xmlAllBlocks(xml, "ModeloMotoWM");
  return blocks.map((b) => ({
    codigo: Number(xmlFirstText(b, "CodigoModelo") ?? "0"),
    nome: String(xmlFirstText(b, "NomeModelo") ?? "").trim(),
    estilo: xmlFirstText(b, "NomeEstiloMoto"),
    anosXml: b,
  })).filter((m) => m.codigo > 0);
}

export async function wmObterCoresMotosUsadas(
  ambiente: WebmotorsAmbiente,
  hash: string,
): Promise<WmCatalogItem[]> {
  const xml = await codigosCall(ambiente, hash, "obterCoresMotosUsadas", "");
  assertSoapOk(xml);
  return parseCatalogItems(xml, "CorMotoUsadaWM", "CodigoCor", "Descricao");
}

export async function wmObterModalidadesMotosUsadas(
  ambiente: WebmotorsAmbiente,
  hash: string,
): Promise<WmCatalogItem[]> {
  const xml = await codigosCall(
    ambiente,
    hash,
    "obterModalidadesMotosUsadas",
    "",
  );
  assertSoapOk(xml);
  return parseCatalogItems(
    xml,
    "ModalidadeMotoWM",
    "CodigoModalidade",
    "Descricao",
  );
}

export type WmMotoAnuncioPayload = {
  CodigoAnuncio: number;
  CodigoMarca: number;
  CodigoModelo: number;
  AnoDoModelo: number;
  AnoFabricacao: number;
  CodigoCorPredominante: number;
  CodigoCorSecundaria: number;
  CodigoNumeroMarchas: number;
  CodigoTipoRefrigeracao: number;
  CodigoTipoAlimentacao: number;
  CodigoTipoMotor: number;
  CodigoTipoPartida: number;
  CodigoTipoFreio: number;
  NumeroCilindradas: number;
  CodigoModalidade: number;
  PrecoRevenda: number;
  PrecoVenda: number;
  Km: string;
  Observacao: string;
  TipoAnuncio: string;
  CodigoSMS: number;
  TipoConsistencia: number;
  EstiloMoto?: string;
};

function buildMotoAnuncioXml(p: WmMotoAnuncioPayload): string {
  return `<anuncioWM>` +
    `<CodigoAnuncio>${p.CodigoAnuncio}</CodigoAnuncio>` +
    `<CodigoMarca>${p.CodigoMarca}</CodigoMarca>` +
    `<CodigoModelo>${p.CodigoModelo}</CodigoModelo>` +
    `<AnoDoModelo>${p.AnoDoModelo}</AnoDoModelo>` +
    `<AnoFabricacao>${p.AnoFabricacao}</AnoFabricacao>` +
    `<CodigoCorPredominante>${p.CodigoCorPredominante}</CodigoCorPredominante>` +
    `<CodigoCorSecundaria>${p.CodigoCorSecundaria}</CodigoCorSecundaria>` +
    `<CodigoNumeroMarchas>${p.CodigoNumeroMarchas}</CodigoNumeroMarchas>` +
    `<CodigoTipoRefrigeracao>${p.CodigoTipoRefrigeracao}</CodigoTipoRefrigeracao>` +
    `<CodigoTipoAlimentacao>${p.CodigoTipoAlimentacao}</CodigoTipoAlimentacao>` +
    `<CodigoTipoMotor>${p.CodigoTipoMotor}</CodigoTipoMotor>` +
    `<CodigoTipoPartida>${p.CodigoTipoPartida}</CodigoTipoPartida>` +
    `<CodigoTipoFreio>${p.CodigoTipoFreio}</CodigoTipoFreio>` +
    `<NumeroCilindradas>${p.NumeroCilindradas}</NumeroCilindradas>` +
    `<CodigoModalidade>${p.CodigoModalidade}</CodigoModalidade>` +
    `<PrecoRevenda>${p.PrecoRevenda}</PrecoRevenda>` +
    `<PrecoVenda>${p.PrecoVenda}</PrecoVenda>` +
    `<Km>${escapeXml(p.Km)}</Km>` +
    `<Observacao>${escapeXml(p.Observacao)}</Observacao>` +
    `<TipoAnuncio>${escapeXml(p.TipoAnuncio || "U")}</TipoAnuncio>` +
    `<CodigoSMS>${p.CodigoSMS}</CodigoSMS>` +
    `<TipoConsistencia>${p.TipoConsistencia}</TipoConsistencia>` +
    (p.EstiloMoto
      ? `<EstiloMoto>${escapeXml(p.EstiloMoto)}</EstiloMoto>`
      : "") +
    `</anuncioWM>`;
}

export async function wmIncluirMoto(
  ambiente: WebmotorsAmbiente,
  hash: string,
  anuncio: WmMotoAnuncioPayload,
): Promise<{ codigoAnuncio: number; codigoRetorno: string | null }> {
  const xml = await estoqueMotosCall(
    ambiente,
    hash,
    "incluirMoto",
    buildMotoAnuncioXml(anuncio),
  );
  const codigoRetorno = xmlFirstText(xml, "CodigoRetorno");
  const codigoAnuncioRaw = xmlFirstText(xml, "CodigoAnuncio");
  if (!isWebmotorsSuccess(codigoRetorno)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigoRetorno));
  }
  const codigoAnuncio = Number(codigoAnuncioRaw);
  if (!Number.isFinite(codigoAnuncio) || codigoAnuncio <= 0) {
    throw new Error("A Webmotors não retornou o código do anúncio de moto.");
  }
  return { codigoAnuncio, codigoRetorno };
}

export async function wmAlterarMoto(
  ambiente: WebmotorsAmbiente,
  hash: string,
  anuncio: WmMotoAnuncioPayload,
): Promise<void> {
  const xml = await estoqueMotosCall(
    ambiente,
    hash,
    "alterarMoto",
    buildMotoAnuncioXml(anuncio),
  );
  const codigoRetorno = xmlFirstText(xml, "CodigoRetorno");
  if (!isWebmotorsSuccess(codigoRetorno)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigoRetorno));
  }
}

export async function wmExcluirMoto(
  ambiente: WebmotorsAmbiente,
  hash: string,
  codigoAnuncio: number,
  motivo: string,
): Promise<void> {
  const xml = await estoqueMotosCall(
    ambiente,
    hash,
    "excluirMoto",
    `<CodigoAnuncio>${codigoAnuncio}</CodigoAnuncio>` +
      `<MotivoExclusao>${escapeXml(motivo)}</MotivoExclusao>`,
  );
  const codigoRetorno = xmlFirstText(xml, "CodigoRetorno");
  if (!isWebmotorsSuccess(codigoRetorno)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigoRetorno));
  }
}

export async function wmIncluirFotoMotoBase64(
  ambiente: WebmotorsAmbiente,
  hash: string,
  codigoAnuncio: number,
  imageBase64: string,
): Promise<number> {
  const xml = await estoqueMotosCall(
    ambiente,
    hash,
    "incluirFotoMoto",
    `<image>${imageBase64}</image>` +
      `<CodigoAnuncio>${codigoAnuncio}</CodigoAnuncio>`,
  );
  const codigoRetorno = xmlFirstText(xml, "CodigoRetorno");
  if (!isWebmotorsSuccess(codigoRetorno)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigoRetorno));
  }
  const foto = Number(xmlFirstText(xml, "CodigoFoto") ?? "0");
  if (!Number.isFinite(foto) || foto <= 0) {
    throw new Error("Falha ao enviar foto de moto para a Webmotors.");
  }
  return foto;
}

export function parseAnoMotoFromModeloBlock(
  modeloBlockXml: string,
  anoModelo: number,
): {
  NumeroMarchas: number;
  TipoRefrigeracao: number;
  TipoAlimentacao: number;
  TipoMotor: number;
  TipoPartida: number;
  TipoFreio: number;
} | null {
  const anos = xmlAllBlocks(modeloBlockXml, "AnoMotoWM");
  for (const a of anos) {
    const am = Number(xmlFirstText(a, "AnoModelo") ?? "0");
    if (am !== anoModelo) continue;
    return {
      NumeroMarchas: Number(xmlFirstText(a, "NumeroMarchas") ?? "0"),
      TipoRefrigeracao: Number(xmlFirstText(a, "TipoRefrigeracao") ?? "0"),
      TipoAlimentacao: Number(xmlFirstText(a, "TipoAlimentacao") ?? "0"),
      TipoMotor: Number(xmlFirstText(a, "TipoMotor") ?? "0"),
      TipoPartida: Number(xmlFirstText(a, "TipoPartida") ?? "0"),
      TipoFreio: Number(xmlFirstText(a, "TipoFreio") ?? "0"),
    };
  }
  return null;
}
