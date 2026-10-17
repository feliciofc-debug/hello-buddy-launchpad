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

/** Extrai texto do primeiro elemento com tag local (ignora namespace). */
export function xmlFirstText(xml: string, localName: string): string | null {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`, "i");
  const m = xml.match(re);
  if (!m) return null;
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

export function xmlAllBlocks(xml: string, localName: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[0]);
  return out;
}

export function parseSoapFault(xml: string): string | null {
  const fault = xmlFirstText(xml, "faultstring") ?? xmlFirstText(xml, "Reason");
  return fault?.trim() || null;
}
