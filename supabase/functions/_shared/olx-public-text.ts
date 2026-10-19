import { findWebmotorsForbiddenTerm } from "./webmotors-text.ts";

const EXTRA_FORBIDDEN = [
  { label: "custo", re: /\bcusto\b/i },
  { label: "lucro", re: /\blucro\b/i },
  { label: "avaria", re: /\bavaria/i },
  { label: "laudo", re: /\blaudo\b/i },
  { label: "procedência", re: /\bproced[eê]ncia\b/i },
];

export function findOlxForbiddenTerm(text: string): string | null {
  const wm = findWebmotorsForbiddenTerm(text);
  if (wm) return wm;
  for (const rule of EXTRA_FORBIDDEN) {
    if (rule.re.test(text)) return rule.label;
  }
  return null;
}

export function olxPublicBody(descricao: string | null | undefined): string {
  const base = (descricao ?? "").trim();
  if (base.length < 2) {
    return "Veículo disponível. Entre em contato para mais informações.";
  }
  const term = findOlxForbiddenTerm(base);
  if (term) {
    throw new Error(
      `A descrição contém '${term}' e não pode ir para o anúncio OLX.`,
    );
  }
  return base.slice(0, 6000);
}

/** Fotos públicas do estoque — exclui bucket privado de trocas. */
export function olxPublicPhotoUrls(fotos: string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of fotos ?? []) {
    const url = String(raw ?? "").trim();
    if (!url.startsWith("http")) continue;
    if (/\/storage\/v1\/object\/(?:sign|authenticated)\/trocas\//i.test(url)) continue;
    if (/\/storage\/v1\/object\/[^/]+\/trocas\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= 20) break;
  }
  return out;
}
