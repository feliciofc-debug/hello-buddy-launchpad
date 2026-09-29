import { colorsFromLogoDataUrl } from "./brand-assets.ts";

export type BrandSiteIdentity = {
  url: string;
  colors: string[];
  brand_name: string | null;
  logo_url: string | null;
  logo_data_url: string | null;
  logo_confidence: "high" | "none";
};

const MAX_HTML_BYTES = 2_000_000;
const MAX_CSS_BYTES = 300_000;
const MAX_LOGO_BYTES = 1_000_000;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "AMZBrandIdentity/1.0";
const GENERIC_FRAMEWORK_COLORS = new Set([
  "#f87171",
  "#fecaca",
  "#ef4444",
  "#dc2626",
  "#9333ea",
  "#a855f7",
  "#7e22ce",
  "#8b5cf6",
  "#c4b5fd",
]);

function normalizeHex(value: string): string | null {
  let raw = value.trim().toLowerCase();
  const rgb = raw.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgb) {
    raw = "#" + rgb.slice(1, 4)
      .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0"))
      .join("");
  }
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    raw = "#" + raw.slice(1).split("").map((char) => char + char).join("");
  }
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : null;
}

function saturation(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((part) => part / 255);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  if (max === min) return 0;
  const lightness = (max + min) / 2;
  return lightness > 0.5
    ? (max - min) / (2 - max - min)
    : (max - min) / (max + min);
}

function isNeutral(hex: string): boolean {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return saturation(hex) < 0.16 || luminance < 0.06 || luminance > 0.95;
}

function addColors(source: string, weights: Map<string, number>, baseWeight = 1): void {
  const declarations = source.match(/#[0-9a-fA-F]{3,6}\b|rgba?\([^)]+\)/g) ?? [];
  for (const declaration of declarations) {
    const color = normalizeHex(declaration);
    if (!color || isNeutral(color)) continue;
    weights.set(color, (weights.get(color) ?? 0) + baseWeight);
  }
}

function attribute(tag: string, name: string): string {
  return tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1] ?? "";
}

function absoluteUrl(value: string, base: URL): string | null {
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

export function cleanSiteBrandName(value: string): string | null {
  return String(value || "")
    .split(/\s+(?:\||-|–|—)\s+|\s*:\s*/, 1)[0]
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || null;
}

export function prioritizeSiteIdentityColors(
  cssColors: string[],
  logoColors: string[],
): string[] {
  const normalizedLogo = logoColors.map(normalizeHex).filter((color): color is string =>
    Boolean(color) && !isNeutral(color!)
  );
  const normalizedCss = cssColors.map(normalizeHex).filter((color): color is string =>
    Boolean(color) && !isNeutral(color!)
  );
  const candidates = [
    ...normalizedLogo,
    ...normalizedCss.filter((color) =>
      normalizedLogo.length === 0
      || !GENERIC_FRAMEWORK_COLORS.has(color)
      || normalizedLogo.some((logoColor) => colorDistance(logoColor, color) < 18)
    ),
  ];
  return candidates
    .filter((color, index, list) => list.findIndex((candidate) =>
      colorDistance(candidate, color) < 28
    ) === index)
    .slice(0, 4);
}

export function extractBrandIdentityFromHtml(
  html: string,
  pageUrl: string,
  linkedCss = "",
): BrandSiteIdentity {
  const base = new URL(pageUrl);
  const weights = new Map<string, number>();
  const themeTags = [...html.matchAll(/<meta[^>]+>/gi)].map((match) => match[0]);
  const siteNameTag = themeTags.find((tag) => {
    const key = attribute(tag, "property") || attribute(tag, "name");
    return /^(?:og:site_name|application-name)$/i.test(key);
  });
  const brandName = cleanSiteBrandName(
    (siteNameTag && attribute(siteNameTag, "content")) || "",
  );
  for (const tag of themeTags) {
    if (attribute(tag, "name").toLowerCase() !== "theme-color") continue;
    const color = normalizeHex(attribute(tag, "content"));
    if (color && !isNeutral(color)) weights.set(color, (weights.get(color) ?? 0) + 1000);
  }

  const embeddedCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
    .join("\n");
  const css = `${embeddedCss}\n${linkedCss}`;
  for (const block of css.split("}")) {
    const separator = block.indexOf("{");
    if (separator < 0) continue;
    const selector = block.slice(0, separator);
    const declarations = block.slice(separator + 1);
    const important = /:root|header|nav|button|btn|cta|primary|brand|marca/i.test(selector);
    addColors(declarations, weights, important ? 18 : 2);
    for (const declaration of declarations.split(";")) {
      const [property, ...rest] = declaration.split(":");
      if (property?.trim().startsWith("--")) {
        addColors(rest.join(":"), weights, 30);
      }
    }
  }

  const header = html.match(/<header\b[\s\S]{0,20000}?<\/header>/i)?.[0] ?? "";
  const logoTag = [...header.matchAll(/<img\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => {
      const evidence = [
        attribute(tag, "class"),
        attribute(tag, "id"),
        attribute(tag, "alt"),
        attribute(tag, "src"),
        attribute(tag, "data-src"),
      ].join(" ");
      return /\b(?:logo|logotipo|logomarca|brand|marca)\b/i.test(evidence);
    });
  const logoSource = logoTag
    ? attribute(logoTag, "data-src") || attribute(logoTag, "src")
    : "";
  const logoUrl = logoSource ? absoluteUrl(logoSource, base) : null;

  let inlineSvg: string | null = null;
  const svg = header.match(/<svg\b[\s\S]{0,100000}?<\/svg>/i)?.[0] ?? "";
  if (svg && /\b(?:logo|logotipo|logomarca|brand|marca)\b/i.test(svg.slice(0, 1000))) {
    inlineSvg = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    addColors(svg, weights, 80);
  }

  const colors = [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color)
    .filter((color, index, list) => list.findIndex((candidate) =>
      colorDistance(candidate, color) < 28
    ) === index)
    .slice(0, 4);

  return {
    url: base.toString(),
    colors,
    brand_name: brandName,
    logo_url: logoUrl,
    logo_data_url: inlineSvg,
    logo_confidence: logoUrl || inlineSvg ? "high" : "none",
  };
}

function colorDistance(a: string, b: string): number {
  const av = Number.parseInt(a.slice(1), 16);
  const bv = Number.parseInt(b.slice(1), 16);
  return Math.sqrt(
    (((av >> 16) & 255) - ((bv >> 16) & 255)) ** 2
      + (((av >> 8) & 255) - ((bv >> 8) & 255)) ** 2
      + ((av & 255) - (bv & 255)) ** 2,
  );
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const numbers = parts.map(Number);
  return numbers.every((part) => part >= 0 && part <= 255) ? numbers : null;
}

export function isPrivateOrLocalAddress(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.endsWith(".internal")
  ) return true;
  const ipv4 = parseIpv4(host);
  if (ipv4) {
    const [a, b] = ipv4;
    return a === 0
      || a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || a >= 224;
  }
  return host === "::1"
    || host === "::"
    || host.startsWith("fc")
    || host.startsWith("fd")
    || host.startsWith("fe8")
    || host.startsWith("fe9")
    || host.startsWith("fea")
    || host.startsWith("feb")
    || host.startsWith("::ffff:127.")
    || host.startsWith("::ffff:10.")
    || host.startsWith("::ffff:192.168.");
}

export async function assertSafePublicUrl(
  rawUrl: string,
  resolver: (hostname: string, recordType: "A" | "AAAA") => Promise<string[]> = async (
    hostname,
    recordType,
  ) => await Deno.resolveDns(hostname, recordType),
): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("A URL precisa começar com http:// ou https://.");
  }
  if (url.username || url.password || isPrivateOrLocalAddress(url.hostname)) {
    throw new Error("URL privada ou local não é permitida.");
  }
  if (!parseIpv4(url.hostname) && !url.hostname.includes(":")) {
    const addresses = [
      ...(await resolver(url.hostname, "A").catch(() => [])),
      ...(await resolver(url.hostname, "AAAA").catch(() => [])),
    ];
    if (!addresses.length || addresses.some(isPrivateOrLocalAddress)) {
      throw new Error("O site não possui um endereço público seguro.");
    }
  }
  return url;
}

export async function readLimited(
  response: Response,
  maxBytes: number,
  truncateAtLimit = false,
): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes && !truncateAtLimit) {
    throw new Error("Resposta maior que o limite permitido.");
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxBytes - total;
    if (value.length > remaining) {
      if (truncateAtLimit && remaining > 0) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
      }
      await reader.cancel();
      if (!truncateAtLimit) throw new Error("Resposta maior que o limite permitido.");
      break;
    }
    chunks.push(value);
    total += value.length;
    if (truncateAtLimit && total === maxBytes) {
      await reader.cancel();
      break;
    }
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

async function safeFetch(
  rawUrl: string,
  signal: AbortSignal,
  maxBytes: number,
  truncateAtLimit = false,
): Promise<{ response: Response; bytes: Uint8Array; finalUrl: URL }> {
  let current = await assertSafePublicUrl(rawUrl);
  for (let redirect = 0; redirect <= 3; redirect++) {
    const response = await fetch(current, {
      signal,
      redirect: "manual",
      headers: { "user-agent": USER_AGENT },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === 3) throw new Error("Redirecionamento inválido.");
      current = await assertSafePublicUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`O site respondeu com HTTP ${response.status}.`);
    return {
      response,
      bytes: await readLimited(response, maxBytes, truncateAtLimit),
      finalUrl: current,
    };
  }
  throw new Error("Redirecionamentos demais.");
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export async function fetchBrandSiteIdentity(rawUrl: string): Promise<BrandSiteIdentity> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const page = await safeFetch(rawUrl, controller.signal, MAX_HTML_BYTES, true);
    const contentType = page.response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) throw new Error("A URL não retornou uma página HTML.");
    const html = new TextDecoder().decode(page.bytes);
    const cssUrls = [...html.matchAll(/<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi)]
      .map((match) => attribute(match[0], "href"))
      .filter(Boolean)
      .map((href) => absoluteUrl(href, page.finalUrl))
      .filter((url): url is string => Boolean(url))
      .slice(0, 3);
    const cssParts: string[] = [];
    for (const cssUrl of cssUrls) {
      try {
        const css = await safeFetch(cssUrl, controller.signal, MAX_CSS_BYTES, true);
        cssParts.push(new TextDecoder().decode(css.bytes));
      } catch {
        // Folha opcional: a identidade continua com o HTML disponível.
      }
    }
    const identity = extractBrandIdentityFromHtml(html, page.finalUrl.toString(), cssParts.join("\n"));
    if (identity.logo_url) {
      try {
        const logo = await safeFetch(identity.logo_url, controller.signal, MAX_LOGO_BYTES);
        const logoType = (logo.response.headers.get("content-type") ?? "").split(";")[0].trim();
        if (/^image\/(?:png|jpeg|webp|svg\+xml)$/i.test(logoType)) {
          identity.logo_data_url = bytesToDataUrl(logo.bytes, logoType);
        } else {
          identity.logo_url = null;
          identity.logo_confidence = "none";
        }
      } catch {
        identity.logo_url = null;
        identity.logo_data_url = null;
        identity.logo_confidence = "none";
      }
    }
    if (identity.logo_confidence === "high" && identity.logo_data_url) {
      const logoColors = await colorsFromLogoDataUrl(identity.logo_data_url).catch(() => []);
      identity.colors = prioritizeSiteIdentityColors(identity.colors, logoColors);
    }
    return identity;
  } finally {
    clearTimeout(timeout);
  }
}
