import {
  WM_LOGIN_NS,
  webmotorsEndpoint,
  type WebmotorsAmbiente,
} from "./webmotors-endpoints.ts";
import {
  escapeXml,
  parseSoapFault,
  soapPost,
  xmlFirstText,
  xmlPrincipalCodigoRetorno,
} from "./webmotors-soap-client.ts";
import { isWebmotorsSuccess, webmotorsCodigoRetornoMessage } from "./webmotors-errors.ts";

export type WebmotorsAuthInput = {
  ambiente: WebmotorsAmbiente;
  cnpj: string;
  email: string;
  senha: string;
};

export async function webmotorsAutenticar(input: WebmotorsAuthInput): Promise<string> {
  const url = webmotorsEndpoint(input.ambiente, "login");
  const body =
    `<autenticar xmlns="${WM_LOGIN_NS}">` +
    `<cnpj>${escapeXml(input.cnpj.replace(/\D/g, ""))}</cnpj>` +
    `<email>${escapeXml(input.email.trim())}</email>` +
    `<senha>${escapeXml(input.senha)}</senha>` +
    `</autenticar>`;
  const xml = await soapPost({
    url,
    soapAction: `${WM_LOGIN_NS}/autenticar`,
    bodyXml: body,
    timeoutMs: 30_000,
  });
  const fault = parseSoapFault(xml);
  if (fault) throw new Error("Falha na autenticação Webmotors. Verifique os dados da loja.");
  const hash = xmlFirstText(xml, "HashAutenticacao");
  const codigo = xmlPrincipalCodigoRetorno(xml, "autenticarResult");
  if (!hash) {
    throw new Error(webmotorsCodigoRetornoMessage(codigo));
  }
  if (!isWebmotorsSuccess(codigo)) {
    throw new Error(webmotorsCodigoRetornoMessage(codigo));
  }
  return hash;
}
