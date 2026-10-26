export type SoapCallOptions = {
  url: string;
  soapAction: string;
  bodyXml: string;
  timeoutMs?: number;
};

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSoapEnvelope(bodyInner: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body>${bodyInner}</soap:Body></soap:Envelope>`;
}

export async function soapPost(options: SoapCallOptions): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(options.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${options.soapAction}"`,
      },
      body: buildSoapEnvelope(options.bodyXml),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        res.status >= 500
          ? "A Webmotors está indisponível no momento. Tente novamente."
          : "Não foi possível falar com a Webmotors. Verifique credenciais e ambiente.",
      );
    }
    return text;
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("Tempo esgotado ao contactar a Webmotors. Tente novamente.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function decodeXmlText(raw: string): string {
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function isSelfClosingTag(openTag: string): boolean {
  return /\/>\s*$/.test(openTag.trim());
}

function localTagPattern(localName: string): string {
  /** Evita casar CodigoAnuncio ao buscar Anuncio, etc. */
  return `(?:[\\w.-]+:)?${localName}(?![\\w.-])`;
}

/** Itera elementos (ignora namespace). Self-closing → inner null. Texto com "<" → null. */
export function xmlEachElementText(
  xml: string,
  localName: string,
  fn: (text: string | null) => void,
): void {
  const tag = localTagPattern(localName);
  const openRe = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(xml)) !== null) {
    const openTag = m[0];
    if (isSelfClosingTag(openTag)) {
      fn(null);
      continue;
    }
    const contentStart = m.index + openTag.length;
    const closeRe = new RegExp(`<\\/${tag}>`, "i");
    const slice = xml.slice(contentStart);
    const closeM = slice.match(closeRe);
    if (!closeM || closeM.index === undefined) continue;
    const inner = slice.slice(0, closeM.index);
    const text = decodeXmlText(inner);
    if (!text || text.includes("<")) {
      fn(null);
      continue;
    }
    fn(text);
  }
}

/** Extrai texto do primeiro elemento com tag local (ignora namespace). */
export function xmlFirstText(xml: string, localName: string): string | null {
  let first: string | null = null;
  xmlEachElementText(xml, localName, (text) => {
    if (first === null && text !== null) first = text;
  });
  return first;
}

export function xmlLastText(xml: string, localName: string): string | null {
  let last: string | null = null;
  xmlEachElementText(xml, localName, (text) => {
    if (text !== null) last = text;
  });
  return last;
}

/** Tenta cada tag em ordem; usa a primeira que retornar blocos. */
export function xmlAllBlocksPrefer(
  xml: string,
  ...localNames: string[]
): string[] {
  for (const name of localNames) {
    const blocks = xmlAllBlocks(xml, name);
    if (blocks.length > 0) return blocks;
  }
  return [];
}

export function xmlAllBlocks(xml: string, localName: string): string[] {
  const tag = localTagPattern(localName);
  const openRe = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(xml)) !== null) {
    if (isSelfClosingTag(m[0])) continue;
    const contentStart = m.index + m[0].length;
    const closeRe = new RegExp(`<\\/${tag}>`, "i");
    const slice = xml.slice(contentStart);
    const closeM = slice.match(closeRe);
    if (!closeM || closeM.index === undefined) continue;
    out.push(
      xml.slice(m.index, contentStart + closeM.index + closeM[0].length),
    );
  }
  return out;
}

export function xmlResultInnerXml(
  xml: string,
  resultLocalName: string,
): string | null {
  const tag = localTagPattern(resultLocalName);
  const m = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  return m?.[1] ?? null;
}

/** Remove blocos de opcionais antes de ler CodigoRetorno do Result. */
export function stripWebmotorsNestedOpcionalXml(xml: string): string {
  return xml
    .replace(/<Opcional>[\s\S]*?<\/Opcional>/gi, "")
    .replace(/<(?:[\w.-]+:)?OpcionalWM\b[^>]*\/>/gi, "")
    .replace(
      /<(?:[\w.-]+:)?OpcionalWM\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?OpcionalWM>/gi,
      "",
    );
}

/** CodigoRetorno do envelope *Result (ignora vazio/aninhado em OpcionalWM). */
export function xmlPrincipalCodigoRetorno(
  xml: string,
  resultLocalName: string,
): string | null {
  const inner = xmlResultInnerXml(xml, resultLocalName);
  const scope = inner
    ? stripWebmotorsNestedOpcionalXml(inner)
    : stripWebmotorsNestedOpcionalXml(xml);
  return xmlLastText(scope, "CodigoRetorno");
}

export function xmlPrincipalFirstText(
  xml: string,
  resultLocalName: string,
  fieldLocalName: string,
): string | null {
  const inner = xmlResultInnerXml(xml, resultLocalName);
  const scope = inner
    ? stripWebmotorsNestedOpcionalXml(inner)
    : stripWebmotorsNestedOpcionalXml(xml);
  return xmlFirstText(scope, fieldLocalName);
}

export function parseSoapFault(xml: string): string | null {
  const fault = xmlFirstText(xml, "faultstring") ?? xmlFirstText(xml, "Reason");
  return fault?.trim() || null;
}
