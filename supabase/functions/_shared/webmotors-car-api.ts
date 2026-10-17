import {
  WM_ESTOQUE_NS,
  webmotorsEndpoint,
  type WebmotorsAmbiente,
} from "./webmotors-endpoints.ts";
import {
  escapeXml,
  soapPost,
  xmlAllBlocks,
  xmlFirstText,
  parseSoapFault,
} from "./webmotors-soap-client.ts";
import { isWebmotorsSuccess, webmotorsCodigoRetornoMessage } from "./webmotors-errors.ts";

export type WmCatalogItem = { codigo: number; nome: string };

function parseCatalogItems(xml: string, blockTag: string, codigoTag: string, nomeTag: string): WmCatalogItem[] {
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

function assertSoapOk(xml: string, resultTag: string): void {
  const fault = parseSoapFault(xml);
  if (fault) throw new Error("Erro ao consultar a Webmotors. Tente novamente.");
  const codigo = xmlFirstText(xml, "CodigoRetorno");
  if (codigo && !isWebmotorsSuccess(codigo)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigo));
  }
  if (!xml.includes(resultTag) && !xml.includes("Result")) {
    throw new Error("Resposta inesperada da Webmotors.");
  }
}

async function estoqueCall(
  ambiente: WebmotorsAmbiente,
  hash: string,
  operation: string,
  innerParams: string,
): Promise<string> {
  const url = webmotorsEndpoint(ambiente, "estoque_carros");
  const body =
    `<${operation} xmlns="${WM_ESTOQUE_NS}">` +
    `<pHashAutenticacao>${escapeXml(hash)}</pHashAutenticacao>` +
    innerParams +
    `</${operation}>`;
  return await soapPost({
    url,
    soapAction: `${WM_ESTOQUE_NS}/${operation}`,
    bodyXml: body,
  });
}

export async function wmObterMarca(ambiente: WebmotorsAmbiente, hash: string): Promise<WmCatalogItem[]> {
  const xml = await estoqueCall(ambiente, hash, "ObterMarca", "");
  assertSoapOk(xml, "ObterMarcaResult");
  return parseCatalogItems(xml, "MarcaWM", "CodigoMarca", "NomeMarca");
}

export async function wmObterModelo(
  ambiente: WebmotorsAmbiente,
  hash: string,
  codigoMarca: number,
): Promise<WmCatalogItem[]> {
  const xml = await estoqueCall(
    ambiente,
    hash,
    "ObterModelo",
    `<pCodigoMarca>${codigoMarca}</pCodigoMarca>`,
  );
  assertSoapOk(xml, "ObterModeloResult");
  return parseCatalogItems(xml, "ModeloWM", "CodigoModelo", "NomeModelo");
}

export async function wmObterVersao(
  ambiente: WebmotorsAmbiente,
  hash: string,
  codigoModelo: number,
): Promise<WmCatalogItem[]> {
  const end = new Date();
  const start = new Date("2000-01-01T00:00:00");
  const xml = await estoqueCall(
    ambiente,
    hash,
    "ObterVersao",
    `<pCodigoModelo>${codigoModelo}</pCodigoModelo>` +
      `<pDataInicioAtualizacao>${start.toISOString()}</pDataInicioAtualizacao>` +
      `<pDataFimAtualizacao>${end.toISOString()}</pDataFimAtualizacao>`,
  );
  assertSoapOk(xml, "ObterVersaoResult");
  return parseCatalogItems(xml, "Versao", "CodigoVersao", "NomeVersao");
}

export async function wmObterCores(ambiente: WebmotorsAmbiente, hash: string): Promise<WmCatalogItem[]> {
  const xml = await estoqueCall(ambiente, hash, "ObterCores", "");
  return parseCatalogItems(xml, "CorWM", "CodigoCor", "Descricao");
}

export async function wmObterCombustivel(ambiente: WebmotorsAmbiente, hash: string): Promise<WmCatalogItem[]> {
  const xml = await estoqueCall(ambiente, hash, "ObterCombustivel", "");
  return parseCatalogItems(xml, "CombustivelWM", "CodigoCombustivel", "Descricao");
}

export async function wmObterCambio(ambiente: WebmotorsAmbiente, hash: string): Promise<WmCatalogItem[]> {
  const xml = await estoqueCall(ambiente, hash, "ObterCambio", "");
  return parseCatalogItems(xml, "TipoCambioWM", "CodigoCambio", "Descricao");
}

export async function wmObterNumeroPortas(ambiente: WebmotorsAmbiente, hash: string): Promise<number[]> {
  const xml = await estoqueCall(ambiente, hash, "ObterNumeroPortas", "");
  const blocks = xmlAllBlocks(xml, "NumeroPortasWM");
  const nums: number[] = [];
  for (const b of blocks) {
    const desc = xmlFirstText(b, "Descricao");
    const cod = xmlFirstText(b, "CodigoPortas");
    const fromDesc = desc ? Number(desc.replace(/\D/g, "")) : NaN;
    if (Number.isFinite(fromDesc) && fromDesc > 0) nums.push(fromDesc);
    else if (cod) nums.push(Number(cod));
  }
  return nums.filter((n) => Number.isFinite(n) && n > 0);
}

export async function wmObterModalidade(ambiente: WebmotorsAmbiente, hash: string): Promise<WmCatalogItem[]> {
  const xml = await estoqueCall(ambiente, hash, "ObterModalidade", "");
  return parseCatalogItems(xml, "ModalidadeWM", "CodigoModalidade", "Descricao");
}

export async function wmObterOpcionais(ambiente: WebmotorsAmbiente, hash: string): Promise<WmCatalogItem[]> {
  const xml = await estoqueCall(ambiente, hash, "ObterOpcionais", "");
  return parseCatalogItems(xml, "OpcionalWM", "CodigoOpcional", "Descricao");
}

export type WmAnuncioPayload = {
  CodigoAnuncio: number;
  CodigoModalidade: number;
  TipoAnuncio: string;
  CodigoMarca: number;
  CodigoModelo: number;
  CodigoVersao: number;
  AnoDoModelo: number;
  AnoFabricacao: number;
  Km: number;
  CodigoCambio: number;
  NrPortas: number;
  CodigoCor: number;
  CodigoCombustivel: number;
  Blindado: string;
  PrecoReal: number;
  PrecoVenda: number;
  Observacao: string;
  OpcionalCodigos: number[];
};

function buildAnuncioXml(p: WmAnuncioPayload): string {
  const opcionais = p.OpcionalCodigos.map((c) =>
    `<OpcionalWM><CodigoOpcional>${c}</CodigoOpcional></OpcionalWM>`
  ).join("");
  return `<pAnuncio>` +
    `<CodigoAnuncio>${p.CodigoAnuncio}</CodigoAnuncio>` +
    `<CodigoModalidade>${p.CodigoModalidade}</CodigoModalidade>` +
    `<TipoAnuncio>${escapeXml(p.TipoAnuncio || "U")}</TipoAnuncio>` +
    `<CodigoMarca>${p.CodigoMarca}</CodigoMarca>` +
    `<CodigoModelo>${p.CodigoModelo}</CodigoModelo>` +
    `<CodigoVersao>${p.CodigoVersao}</CodigoVersao>` +
    `<AnoDoModelo>${p.AnoDoModelo}</AnoDoModelo>` +
    `<AnoFabricacao>${p.AnoFabricacao}</AnoFabricacao>` +
    `<Km>${p.Km}</Km>` +
    `<CodigoCambio>${p.CodigoCambio}</CodigoCambio>` +
    `<NrPortas>${p.NrPortas}</NrPortas>` +
    `<CodigoCor>${p.CodigoCor}</CodigoCor>` +
    `<CodigoCombustivel>${p.CodigoCombustivel}</CodigoCombustivel>` +
    `<Blindado>${escapeXml(p.Blindado)}</Blindado>` +
    `<PrecoReal>${p.PrecoReal}</PrecoReal>` +
    `<PrecoVenda>${p.PrecoVenda}</PrecoVenda>` +
    `<Observacao>${escapeXml(p.Observacao)}</Observacao>` +
    `<Opcional>${opcionais}</Opcional>` +
    `</pAnuncio>`;
}

export async function wmIncluirCarro(
  ambiente: WebmotorsAmbiente,
  hash: string,
  anuncio: WmAnuncioPayload,
): Promise<{ codigoAnuncio: number; codigoRetorno: string | null }> {
  const xml = await estoqueCall(ambiente, hash, "IncluirCarro", buildAnuncioXml(anuncio));
  const codigoRetorno = xmlFirstText(xml, "CodigoRetorno");
  const codigoAnuncioRaw = xmlFirstText(xml, "CodigoAnuncio");
  if (!isWebmotorsSuccess(codigoRetorno)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigoRetorno));
  }
  const codigoAnuncio = Number(codigoAnuncioRaw);
  if (!Number.isFinite(codigoAnuncio) || codigoAnuncio <= 0) {
    throw new Error("A Webmotors não retornou o código do anúncio.");
  }
  return { codigoAnuncio, codigoRetorno };
}

export async function wmAlterarCarro(
  ambiente: WebmotorsAmbiente,
  hash: string,
  anuncio: WmAnuncioPayload,
): Promise<void> {
  const xml = await estoqueCall(ambiente, hash, "AlterarCarro", buildAnuncioXml(anuncio));
  const codigoRetorno = xmlFirstText(xml, "CodigoRetorno");
  if (!isWebmotorsSuccess(codigoRetorno)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigoRetorno));
  }
}

export async function wmExcluirCarro(
  ambiente: WebmotorsAmbiente,
  hash: string,
  codigoAnuncio: number,
  motivo: string,
): Promise<void> {
  const xml = await estoqueCall(
    ambiente,
    hash,
    "ExcluirCarro",
    `<pCodigoAnuncio>${codigoAnuncio}</pCodigoAnuncio>` +
      `<pMotivoExclusao>${escapeXml(motivo)}</pMotivoExclusao>`,
  );
  const codigoRetorno = xmlFirstText(xml, "CodigoRetorno");
  if (!isWebmotorsSuccess(codigoRetorno)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigoRetorno));
  }
}

export async function wmIncluirFotoUrl(
  ambiente: WebmotorsAmbiente,
  hash: string,
  codigoAnuncio: number,
  url: string,
): Promise<number> {
  const xml = await estoqueCall(
    ambiente,
    hash,
    "IncluirFotoUrl",
    `<oUrlImagem>${escapeXml(url)}</oUrlImagem>` +
      `<pCodigoAnuncio>${codigoAnuncio}</pCodigoAnuncio>`,
  );
  const codigoRetorno = xmlFirstText(xml, "CodigoRetorno");
  if (!isWebmotorsSuccess(codigoRetorno)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigoRetorno));
  }
  const foto = Number(xmlFirstText(xml, "CodigoFotoAnuncio") ?? xmlFirstText(xml, "CodigoFoto"));
  if (!Number.isFinite(foto)) throw new Error("Falha ao enviar foto para a Webmotors.");
  return foto;
}

export async function wmObterFotosCarro(
  ambiente: WebmotorsAmbiente,
  hash: string,
  codigoAnuncio: number,
): Promise<Array<{ codigo: number; url?: string }>> {
  const xml = await estoqueCall(
    ambiente,
    hash,
    "ObterFotosCarro",
    `<pCodigoAnuncio>${codigoAnuncio}</pCodigoAnuncio>`,
  );
  const blocks = xmlAllBlocks(xml, "FotoAnuncioWM");
  return blocks.map((b) => ({
    codigo: Number(xmlFirstText(b, "CodigoFotoAnuncio") ?? "0"),
    url: xmlFirstText(b, "UrlImagem") ?? undefined,
  })).filter((f) => f.codigo > 0);
}

export async function wmExcluirFoto(
  ambiente: WebmotorsAmbiente,
  hash: string,
  codigoAnuncio: number,
  codigoFoto: number,
): Promise<void> {
  const xml = await estoqueCall(
    ambiente,
    hash,
    "ExcluirFoto",
    `<pCodigoAnuncio>${codigoAnuncio}</pCodigoAnuncio>` +
      `<pCodigoFotoAnuncio>${codigoFoto}</pCodigoFotoAnuncio>`,
  );
  const codigoRetorno = xmlFirstText(xml, "CodigoRetorno");
  if (!isWebmotorsSuccess(codigoRetorno)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigoRetorno));
  }
}
