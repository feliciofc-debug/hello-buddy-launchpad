/** Termos específicos primeiro; texto já normalizado (minúsculo, sem acento). */
const MAP: Array<{ re: RegExp; categoria: string }> = [
  {
    re: /\bmartelinho|\bamassad|\bpara-choque|\bparachoque|\bretoque|\brisco|\blataria|\bfunilaria|\bpintura/,
    categoria: "funilaria_pintura",
  },
  {
    re: /\bbateria|\bembreag|\bfreio|\bpastilha|\bdisco de freio|\bsuspens|\bamortecedor|\boleo|\btroca de oleo|\bcorreia|\bmotor|\bcambio|\binjecao|\bvela|\bfiltro|\bradiador|\balternador|\bmotor de arranque|\beletric|\bar condicionado|\brevis|\boficina|\bmecani/,
    categoria: "mecanica",
  },
  { re: /\bpneu|\balinhamento|\bbalanceamento|\broda/, categoria: "pneus" },
  {
    re: /\bpolimento|\bvitrific|\bcristaliz|\bhigieniz|\blavagem|\benceramento|\binsulfilm|\bpelicula|\bdetailing|\besteti/,
    categoria: "estetica",
  },
  {
    re: /\bdespachante|\bvistoria|\blaudo|\bcautelar|\bipva|\blicenciamento|\bmulta|\bcrv|\bdut|\bemplacamento|\bplaca|\btransfer|\bdetran|\bdocument/,
    categoria: "documentacao",
  },
  { re: /\bcegonha|\breboque|\bguincho|\bfrete|\btransport/, categoria: "transporte" },
  {
    re: /\banunc|\bportal|\bwebmotors|\bolx|\bmercado livre|\bicarros|\bimpulsion/,
    categoria: "anuncio",
  },
  { re: /\bcomiss/, categoria: "comissao" },
];

export const GESTAO_DESPESA_CATEGORIA_CODES = [
  "mecanica",
  "funilaria_pintura",
  "pneus",
  "estetica",
  "documentacao",
  "transporte",
  "anuncio",
  "comissao",
  "outros",
] as const;

const LABELS: Record<string, string> = {
  mecanica: "Mecânica",
  funilaria_pintura: "Funilaria e pintura",
  pneus: "Pneus",
  estetica: "Estética",
  documentacao: "Documentação",
  transporte: "Transporte",
  anuncio: "Anúncio",
  comissao: "Comissão",
  outros: "Outros",
};

export function gestaoDespesaCategoriaLabel(categoria: string): string {
  return LABELS[categoria] ?? categoria;
}

export function inferGestaoCategoria(text: string): string {
  const t = normalizeGestaoCategoriaText(text);
  for (const { re, categoria } of MAP) {
    if (re.test(t)) return categoria;
  }
  return "outros";
}

export function normalizeGestaoCategoriaText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Corrige categoria pela resposta do lojista (nome ou código) antes do SIM. */
export function resolveGestaoCategoriaFromUserReply(text: string): string | null {
  const t = normalizeGestaoCategoriaText(text).trim();
  if (!t || t.length > 80) return null;
  if (isSimNaoLike(t)) return null;

  for (const code of GESTAO_DESPESA_CATEGORIA_CODES) {
    if (code === "outros") continue;
    if (t === code || t.replace(/_/g, " ") === code.replace(/_/g, " ")) return code;
    const label = normalizeGestaoCategoriaText(LABELS[code] ?? "");
    if (t === label) return code;
    if (t.length >= 4 && (label.includes(t) || t.includes(label))) return code;
  }

  const aliases: Array<{ re: RegExp; categoria: string }> = [
    { re: /\bmecan/, categoria: "mecanica" },
    { re: /\bfunil|\bpintur/, categoria: "funilaria_pintura" },
    { re: /\bpneu/, categoria: "pneus" },
    { re: /\bestet|\bpoliment/, categoria: "estetica" },
    { re: /\bdocument|\bdespach/, categoria: "documentacao" },
    { re: /\btransport|\bguincho|\bfrete/, categoria: "transporte" },
    { re: /\banunc|\bportal/, categoria: "anuncio" },
  ];
  for (const { re, categoria } of aliases) {
    if (re.test(t)) return categoria;
  }
  return null;
}

function isSimNaoLike(t: string): boolean {
  const compact = t.replace(/[!.,…]+$/g, "").trim();
  if (/^(s|ss|sim(\s+pode)?|pode|confirmo|confirma|ok)$/i.test(compact)) return true;
  if (/^(n|nao|não)(\s+pode)?$/i.test(compact)) return true;
  if (/^cancelar$/i.test(compact)) return true;
  return false;
}
