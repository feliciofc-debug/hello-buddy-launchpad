export type GestaoTrocaKbbCategoria =
  | "hatchback"
  | "seda"
  | "suv-crossover"
  | "picape"
  | "cupe"
  | "minivan"
  | "conversivel"
  | "perua"
  | "utilitario";

export type BuildKbbUrlInput = {
  uf?: string | null;
  marca: string;
  modelo: string;
  ano_modelo?: number | null;
  categoria?: GestaoTrocaKbbCategoria | string | null;
};

const UF_PADRAO = "sp";

/** Extrai UF (2 letras) de perfil/cadastro; padrão SP. */
export function lojaUfParaKbb(input?: {
  endereco?: unknown;
  cidade_uf?: string | null;
}): string {
  const fromCadastro = parseUfFromText(input?.cidade_uf);
  if (fromCadastro) return fromCadastro;

  const end = input?.endereco;
  if (end && typeof end === "object") {
    const o = end as Record<string, unknown>;
    const uf = parseUfFromText(o.uf ?? o.estado ?? o.UF ?? o.Estado);
    if (uf) return uf;
    const cidade = parseUfFromText(o.cidade ?? o.municipio ?? o.cidade_uf);
    if (cidade) return cidade;
  }
  if (typeof end === "string") {
    const uf = parseUfFromText(end);
    if (uf) return uf;
  }

  return UF_PADRAO;
}

export function parseUfFromText(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const slash = s.match(/\/\s*([A-Za-z]{2})\s*$/);
  if (slash) return slash[1].toLowerCase();
  const two = s.match(/\b([A-Za-z]{2})\b$/);
  if (two && two[1].length === 2) return two[1].toLowerCase();
  return null;
}

export function slugifyKbbSegment(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugifyKbbModelo(modelo: string, marca: string): string {
  const marcaNorm = String(marca || "").trim().toLowerCase();
  if (marcaNorm === "land rover") {
    return slugifyKbbSegment(modelo);
  }
  const first = String(modelo || "").trim().split(/\s+/)[0] ?? "";
  return slugifyKbbSegment(first);
}

export function buildGestaoTrocaKbbUrl(input: BuildKbbUrlInput): string {
  const uf = (input.uf?.trim().toLowerCase() || UF_PADRAO).slice(0, 2);
  const marcaSlug = slugifyKbbSegment(input.marca);
  if (!marcaSlug) return `https://www.kbb.com.br/${uf}/marcas/`;

  const categoria = String(input.categoria ?? "").trim();
  if (!categoria) {
    return `https://www.kbb.com.br/${uf}/marcas/${marcaSlug}/`;
  }

  const modeloSlug = slugifyKbbModelo(input.modelo, input.marca);
  const ano = input.ano_modelo != null ? String(Math.round(Number(input.ano_modelo))) : "";
  if (!modeloSlug || !ano) {
    return `https://www.kbb.com.br/${uf}/marcas/${marcaSlug}/`;
  }

  return `https://www.kbb.com.br/${uf}/marcas/${marcaSlug}/${categoria}/${modeloSlug}/${ano}`;
}

export function labelGestaoTrocaKbbLink(input: {
  marca: string;
  modelo: string;
  ano_modelo?: number | null;
  categoria?: string | null;
}): string {
  const marca = String(input.marca || "").trim();
  const modelo = String(input.modelo || "").trim();
  const cat = String(input.categoria ?? "").trim();
  const ano = input.ano_modelo;
  if (cat && modelo && ano) {
    return `Abrir ${marca} ${modelo} ${ano} na KBB`;
  }
  return `Abrir ${marca || "veículo"} na KBB`;
}

export const GESTAO_TROCA_KBB_CATEGORIAS: {
  value: GestaoTrocaKbbCategoria;
  label: string;
}[] = [
  { value: "hatchback", label: "Hatch" },
  { value: "seda", label: "Sedã" },
  { value: "suv-crossover", label: "SUV/Crossover" },
  { value: "picape", label: "Picape" },
  { value: "cupe", label: "Cupê" },
  { value: "minivan", label: "Minivan" },
  { value: "conversivel", label: "Conversível" },
  { value: "perua", label: "Perua" },
  { value: "utilitario", label: "Utilitário" },
];
