/** Decodifica bytes de OFX/CSV conforme cabeçalho ou heurística (bancos BR). */
export function detectOfxCharset(headerText: string): "utf-8" | "windows-1252" | "iso-8859-1" {
  const h = headerText.slice(0, 800);
  const charset = h.match(/CHARSET\s*:\s*(\d+)/i)?.[1];
  if (charset === "1252" || charset === "65001") {
    return charset === "1252" ? "windows-1252" : "utf-8";
  }
  const enc = h.match(/ENCODING\s*:\s*(\w+)/i)?.[1]?.toUpperCase();
  if (enc === "USASCII" || enc === "ASCII") return "iso-8859-1";
  if (enc === "UTF-8") return "utf-8";
  return "windows-1252";
}

export function decodeBytesWithEncoding(bytes: Uint8Array, encoding: string): string {
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("iso-8859-1").decode(bytes);
  }
}

export function decodeOfxBytes(bytes: Uint8Array): string {
  const probe = decodeBytesWithEncoding(bytes, "iso-8859-1");
  const enc = detectOfxCharset(probe);
  if (enc === "iso-8859-1") return probe;
  return decodeBytesWithEncoding(bytes, enc);
}

export function decodeCsvBytes(bytes: Uint8Array, prefer: "utf-8" | "windows-1252" = "utf-8"): string {
  const utf8 = decodeBytesWithEncoding(bytes, "utf-8");
  if (prefer === "utf-8" && !looksLikeBrokenUtf8(utf8)) return utf8;
  const win = decodeBytesWithEncoding(bytes, "windows-1252");
  if (prefer === "windows-1252") return win;
  return looksLikeBrokenUtf8(utf8) ? win : utf8;
}

function looksLikeBrokenUtf8(text: string): boolean {
  return text.includes("\uFFFD") || /Ã.|�/.test(text.slice(0, 4000));
}
