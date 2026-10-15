import { isAutomotiveTenant } from "./vertical-router.ts";
import type { VitrineRecadoResume } from "./vehicle-stock-cliente-nome.ts";
import {
  formatRecadoClienteLine,
  vitrineNomeParaRecado,
} from "./vehicle-stock-cliente-nome.ts";

export const VITRINE_ID_PREFIX = "veiculo_vitrine:";

export type VehicleShowcaseTenantFlags = {
  segmento: string | null;
  vitrine_veiculos_demo: boolean;
  nome_empresa?: string | null;
};

export type FaixaPrecoId = "ate_300" | "300_600" | "acima_600";

export type PendingVitrineEstoque = {
  stage:
    | "menu"
    | "carrossel_marca"
    | "carrossel_faixa"
    | "detalhe"
    | "handoff"
    | "marcas"
    | "carrossel";
  marca?: string | null;
  faixa?: FaixaPrecoId | null;
  filtro_tipo?: "marca" | "faixa" | null;
  offset: number;
  marca_offset?: number;
  veiculo_id?: string | null;
  carousel_ids?: string[] | null;
  carousel_index?: number | null;
  form?: VitrineEstoqueForm | null;
  /** Formulário da vitrine pausado enquanto pergunta o nome (ex.: troca). */
  form_suspend_backup?: VitrineEstoqueForm | null;
  /** Nome preferido do cliente para recados (Commit D). */
  cliente_nome?: string | null;
  /** Recados ao dono já enviados (anti-duplicidade). */
  recados_idempotencia?: Array<{ key: string; at: string }>;
  updated_at: string;
};

export type VitrineVisitaTurno = "manha" | "tarde";

export type VitrineEstoqueForm = {
  flow: "visita" | "troca" | "financiamento" | "cliente_nome";
  step: string;
  veiculo_id: string;
  resume?: VitrineRecadoResume;
  dia_iso?: string;
  turno?: VitrineVisitaTurno;
  updated_at: string;
  modelo_ano?: string;
  km?: string;
  placa?: string;
  troca_sessao_id?: string;
  foto_slot_index?: number;
  foto_slot_retries?: number;
  fotos?: Array<{
    slot: string;
    url: string;
    vision?: {
      view?: string | null;
      nitida?: boolean | null;
      km_lido?: number | null;
      luzes_alerta?: boolean | null;
      avarias?: string | null;
      visao_indisponivel?: boolean;
      nota_avaliador?: string | null;
    };
  }>;
  observacoes?: string;
  troca_observacoes_internas?: string[];
  lgpd_aceite_em?: string;
  tipo_pessoa?: "pf" | "pj";
  nome_completo?: string;
  cpf_cnpj?: string;
  data_nascimento?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  renda_mensal?: string;
  telefone_referencia?: string;
  entrada?: string;
  prazo_meses?: string;
};

export const VITRINE_FORM_TTL_MS = 15 * 60 * 1000;
export const VITRINE_RECADO_IDEMPOTENCY_MS = 10 * 60 * 1000;

export const VITRINE_SEND_RETRY_DELAYS_MS = [1500, 3000] as const;
export const VITRINE_TRANSIENT_META_CODES = [131000, 131016, 130429] as const;

export function isTransientVitrineSendFailure(result: {
  httpStatus?: number;
  metaError?: unknown;
}): boolean {
  if (result.httpStatus != null && result.httpStatus >= 500) return true;
  const blob = typeof result.metaError === "string"
    ? result.metaError
    : JSON.stringify(result.metaError ?? "");
  return VITRINE_TRANSIENT_META_CODES.some((code) =>
    blob.includes(String(code))
  );
}

export type VitrineRecadoAcao =
  | "visita"
  | "financiamento"
  | "interesse"
  | "consultor"
  | "troca";

export function buildVitrineRecadoIdempotencyKey(input: {
  acao: VitrineRecadoAcao;
  fromNumber: string;
  veiculoId: string;
  diaIso?: string;
  turno?: string;
}): string {
  const phone = String(input.fromNumber || "").replace(/\D/g, "");
  const base = `${input.acao}:${phone}:${input.veiculoId}`;
  if (input.acao === "visita" && input.diaIso && input.turno) {
    return `${base}:${input.diaIso}:${input.turno}`;
  }
  return base;
}

export function vitrineRecadoJaEnviado(
  pending: PendingVitrineEstoque | null | undefined,
  key: string,
  nowMs = Date.now(),
): boolean {
  const list = pending?.recados_idempotencia ?? [];
  return list.some((entry) => {
    if (entry.key !== key) return false;
    const at = Date.parse(entry.at);
    return Number.isFinite(at) && nowMs - at <= VITRINE_RECADO_IDEMPOTENCY_MS;
  });
}

export function registerVitrineRecadoIdempotency(
  pending: PendingVitrineEstoque,
  key: string,
  nowMs = Date.now(),
): PendingVitrineEstoque {
  const now = new Date(nowMs).toISOString();
  const kept = (pending.recados_idempotencia ?? []).filter((entry) => {
    const at = Date.parse(entry.at);
    return Number.isFinite(at) && nowMs - at <= VITRINE_RECADO_IDEMPOTENCY_MS;
  });
  return {
    ...pending,
    recados_idempotencia: [...kept, { key, at: now }],
    updated_at: now,
  };
}

export type ShowcaseListRow = {
  id: string;
  title: string;
  description?: string;
};

export type ShowcaseMenuSection = {
  title: string;
  rows: ShowcaseListRow[];
};

const FAIXA_ORDER: FaixaPrecoId[] = ["ate_300", "300_600", "acima_600"];

export function faixaPrecoLabel(faixa: FaixaPrecoId): string {
  switch (faixa) {
    case "ate_300":
      return "Até R$ 300 mil";
    case "300_600":
      return "R$ 300–600 mil";
    case "acima_600":
      return "Acima de R$ 600 mil";
  }
}

export function classifyPrecoFaixa(preco: number | null | undefined): FaixaPrecoId | null {
  if (preco == null || !Number.isFinite(Number(preco))) return null;
  const p = Number(preco);
  if (p <= 300_000) return "ate_300";
  if (p <= 600_000) return "300_600";
  return "acima_600";
}

export function countVehiclesByFaixa(
  precos: Array<number | null | undefined>,
): Record<FaixaPrecoId, number> {
  const out: Record<FaixaPrecoId, number> = {
    ate_300: 0,
    "300_600": 0,
    acima_600: 0,
  };
  for (const preco of precos) {
    const faixa = classifyPrecoFaixa(preco);
    if (faixa) out[faixa] += 1;
  }
  return out;
}

export function activeFaixasFromCounts(
  counts: Record<FaixaPrecoId, number>,
): FaixaPrecoId[] {
  return FAIXA_ORDER.filter((f) => counts[f] > 0);
}

/** Menu inicial: seções Por marca + Por faixa, total ≤10 rows. */
export function buildShowcaseMenuSections(input: {
  marcas: string[];
  marcaOffset?: number;
  faixasAtivas: FaixaPrecoId[];
}): {
  sections: ShowcaseMenuSection[];
  hasMoreMarcas: boolean;
} {
  const marcaOffset = input.marcaOffset ?? 0;
  const faixaRows: ShowcaseListRow[] = input.faixasAtivas.map((faixa) => ({
    id: vitrineButtonId("faixa", faixa),
    title: faixaPrecoLabel(faixa).slice(0, 24),
    description: "Ver carros nesta faixa",
  }));

  const maxRows = 10;
  let slotsForMarcas = Math.max(0, maxRows - faixaRows.length);
  const remainingMarcas = input.marcas.length - marcaOffset;
  const needsMoreRow = remainingMarcas > slotsForMarcas;
  if (needsMoreRow && slotsForMarcas > 0) slotsForMarcas -= 1;

  const marcasSlice = input.marcas.slice(marcaOffset, marcaOffset + slotsForMarcas);
  const hasMoreMarcas = marcaOffset + marcasSlice.length < input.marcas.length;

  const marcaRows: ShowcaseListRow[] = marcasSlice.map((marca) => ({
    id: vitrineButtonId("marca", marcaToSlug(marca)),
    title: marca.slice(0, 24),
    description: "Ver carros desta marca",
  }));

  if (hasMoreMarcas) {
    marcaRows.push({
      id: vitrineButtonId("menu_marcas", String(marcaOffset + marcasSlice.length)),
      title: "Ver mais marcas",
      description: "Outras marcas disponíveis",
    });
  }

  const sections: ShowcaseMenuSection[] = [];
  if (faixaRows.length) {
    sections.push({ title: "Por faixa de preço", rows: faixaRows });
  }
  if (marcaRows.length) {
    sections.push({ title: "Por marca", rows: marcaRows });
  }
  return { sections, hasMoreMarcas };
}

export type VeiculoVitrineRow = {
  id: string;
  marca: string;
  modelo: string;
  versao: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  km: number | null;
  preco: number | null;
  cor: string | null;
  cambio: string | null;
  combustivel: string | null;
  portas: number | null;
  blindado: boolean;
  nivel_blindagem: string | null;
  opcionais: string[] | null;
  caracteristicas: string[] | null;
  descricao: string | null;
  fotos: string[] | null;
  status: string;
};

export function shouldOfferVehicleShowcase(
  flags: VehicleShowcaseTenantFlags,
): boolean {
  return isAutomotiveTenant(flags.segmento) || flags.vitrine_veiculos_demo === true;
}

export function isVitrineInteractiveId(id: string): boolean {
  return String(id || "").toLowerCase().startsWith(VITRINE_ID_PREFIX);
}

export function resolveVitrineInboundButtonId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as {
    interactive?: { button_reply?: { id?: string } };
    button?: { payload?: string };
  };
  const interactiveId = String(record.interactive?.button_reply?.id ?? "");
  if (isVitrineInteractiveId(interactiveId)) return interactiveId;
  const carouselPayload = String(record.button?.payload ?? "");
  if (isVitrineInteractiveId(carouselPayload)) return carouselPayload;
  return interactiveId || carouselPayload || "";
}

/** Quick reply de carrossel Meta: type button + button.payload (não interactive.button_reply). */
export function formatCarouselVitrineButtonText(
  button: { payload?: string; text?: string } | undefined,
): string | null {
  if (!button?.payload) return null;
  const id = String(button.payload);
  if (!isVitrineInteractiveId(id)) return null;
  const text = String(button.text ?? "").trim();
  return text ? `${text}\n<<INTERACTIVE_ID:${id}>>` : `<<INTERACTIVE_ID:${id}>>`;
}

export function extractVitrineInteractiveId(input: {
  userText?: string;
  buttonId?: string;
  listId?: string;
  inboundPayload?: unknown;
}): string | null {
  const fromPayload = input.inboundPayload
    ? resolveVitrineInboundButtonId(input.inboundPayload)
    : "";
  const direct = fromPayload || input.buttonId || input.listId || "";
  if (isVitrineInteractiveId(direct)) return String(direct);
  const match = String(input.userText || "").match(
    /<<INTERACTIVE_ID:(veiculo_vitrine:[^>]+)>>/i,
  );
  return match?.[1] ?? null;
}

/** Gatilhos que mencionam carro/veículo explicitamente (conta demo não automotiva). */
const SHOWCASE_TEXT_VEHICLE_SPECIFIC = [
  /\bver\s+carros?\b/,
  /\bquero\s+ver\s+(os\s+)?carros?\b/,
  /\bestoque\s+de\s+veiculos?\b/,
  /\bcarros?\s+disponiveis\b/,
  /\bveiculos?\s+disponiveis\b/,
  /\bmostrar?\s+veiculos?\b/,
  /\bmostrar?\s+carros?\b/,
  /\bver\s+veiculos?\b/,
];

/** Só tenants automotivos (expo genérica de “loja”/“estoque” não dispara vitrine). */
const SHOWCASE_TEXT_AUTOMOTIVE_EXTRA = [
  /\bo\s+que\s+tem\s+na\s+loja\b/,
  /\bver\s+o\s+estoque\b/,
];

function normalizedShowcaseText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
    .toLowerCase()
    .trim();
}

export function isExplicitVehicleShowcaseRequest(
  text: string,
  flags?: VehicleShowcaseTenantFlags,
): boolean {
  const value = normalizedShowcaseText(text);
  if (!value) return false;

  const automotive = isAutomotiveTenant(flags?.segmento ?? null);
  const demoOnly = flags?.vitrine_veiculos_demo === true && !automotive;

  const vehicleSpecific = SHOWCASE_TEXT_VEHICLE_SPECIFIC.some((re) => re.test(value));
  if (demoOnly) return vehicleSpecific;

  const patterns = automotive
    ? [...SHOWCASE_TEXT_VEHICLE_SPECIFIC, ...SHOWCASE_TEXT_AUTOMOTIVE_EXTRA]
    : SHOWCASE_TEXT_VEHICLE_SPECIFIC;
  return patterns.some((re) => re.test(value));
}

export function marcaToSlug(marca: string): string {
  return String(marca || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "marca";
}

export function slugToMarcaCandidates(slug: string, marcas: string[]): string | null {
  const normalizedSlug = String(slug || "").toLowerCase();
  const exact = marcas.find((m) => marcaToSlug(m) === normalizedSlug);
  if (exact) return exact;
  return marcas.find((m) =>
    marcaToSlug(m).startsWith(normalizedSlug) ||
    normalizedSlug.startsWith(marcaToSlug(m))
  ) ?? null;
}

export function vitrineButtonId(action: string, suffix?: string): string {
  return suffix
    ? `${VITRINE_ID_PREFIX}${action}:${suffix}`
    : `${VITRINE_ID_PREFIX}${action}`;
}

export function parseVitrineButtonId(id: string): {
  action: string;
  parts: string[];
} {
  const raw = id.replace(/^veiculo_vitrine:/i, "");
  const parts = raw.split(":");
  return { action: parts[0] || "", parts: parts.slice(1) };
}

export function formatPrecoBrl(preco: number | null | undefined): string {
  if (preco == null || !Number.isFinite(Number(preco))) return "Consulte";
  return Number(preco).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function formatAno(v: VeiculoVitrineRow): string {
  const af = v.ano_fabricacao;
  const am = v.ano_modelo;
  if (af && am && af !== am) return `${af}/${am}`;
  if (am) return String(am);
  if (af) return String(af);
  return "—";
}

function isValidCalendarDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d;
}

function formatVehicleTitleToken(token: string): string {
  if (/^\d+x\d+$/i.test(token)) return token.toUpperCase();
  if (/[A-Za-z]/.test(token) && /\d/.test(token)) return token;
  if (/\d/.test(token) && !/[A-Za-z]/.test(token)) return token;
  if (token.includes("-")) {
    return token.split("-").map((seg) => formatVehicleTitleToken(seg)).join("-");
  }
  if (/^[A-Za-z]{1,4}$/.test(token) && token === token.toUpperCase()) {
    return token.toUpperCase();
  }
  const lower = token.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Palavras comuns: 1ª maiúscula; siglas/códigos (HSE, P300, XDRIVE40I…) preservados. */
export function formatVehicleDisplayTitle(raw: string): string {
  return String(raw || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(formatVehicleTitleToken)
    .join(" ");
}

export function formatDescricaoVeiculo(text: string): string {
  return String(text || "")
    .trim()
    .split(/\s*·\s*/)
    .filter(Boolean)
    .map((chunk) => formatVehicleDisplayTitle(chunk))
    .join(" · ");
}

export function formatCardBody(v: VeiculoVitrineRow): string {
  const titulo = vehicleDisplayTitle(v);
  const km = v.km != null ? `${v.km.toLocaleString("pt-BR")} km` : null;
  const extras = [formatAno(v), km, v.cambio, v.cor, formatPrecoBrl(v.preco)]
    .filter(Boolean)
    .join(" · ");
  return truncateCardText(`${titulo}\n${extras}`);
}

function truncateCardText(text: string): string {
  const t = text.trim();
  if (t.length <= 160) return t;
  return `${t.slice(0, 157)}...`;
}

/** Título legível — marca exatamente como cadastrada; modelo/versão formatados. */
export function vehicleDisplayTitle(v: VeiculoVitrineRow): string {
  const marca = String(v.marca || "").trim();
  const rest = formatVehicleDisplayTitle(
    [v.modelo, v.versao].filter(Boolean).join(" "),
  );
  return [marca, rest].filter(Boolean).join(" ");
}

export function formatFichaElegante(v: VeiculoVitrineRow): string {
  const lines: string[] = [`*${vehicleDisplayTitle(v)}*`];

  const specs: string[] = [];
  specs.push(`📅 Ano · ${formatAno(v)}`);
  if (v.km != null) specs.push(`🛣️ Km · ${v.km.toLocaleString("pt-BR")}`);
  if (v.cambio) specs.push(`⚙️ Câmbio · ${formatVehicleDisplayTitle(v.cambio)}`);
  if (v.combustivel) {
    specs.push(`⛽ Combustível · ${formatVehicleDisplayTitle(v.combustivel)}`);
  }
  if (v.preco != null) specs.push(`💰 Preço · ${formatPrecoBrl(v.preco)}`);
  if (specs.length) lines.push(specs.join("\n"));

  if (v.cor) lines.push(`Cor · ${formatVehicleDisplayTitle(v.cor)}`);
  if (v.portas != null) lines.push(`Portas · ${v.portas}`);
  if (v.blindado) {
    const extra = v.nivel_blindagem
      ? ` · ${formatDescricaoVeiculo(v.nivel_blindagem)}`
      : "";
    lines.push(`🛡️ Blindado${extra}`);
  }

  if (v.descricao?.trim()) {
    lines.push("");
    lines.push(formatDescricaoVeiculo(v.descricao.trim().slice(0, 500)));
  }

  const opcionais = (v.opcionais || []).filter(Boolean).slice(0, 8);
  if (opcionais.length) {
    lines.push("");
    lines.push("✨ Opcionais");
    for (const item of opcionais) lines.push(`• ${item}`);
  }

  const diferenciais = (v.caracteristicas || []).filter(Boolean).slice(0, 8);
  if (diferenciais.length) {
    lines.push("");
    lines.push("✅ Diferenciais");
    for (const item of diferenciais) lines.push(`• ${item}`);
  }

  return lines.join("\n");
}

/** @deprecated use formatFichaElegante — mantido p/ testes legados */
export function formatDetailLines(v: VeiculoVitrineRow): string[] {
  return formatFichaElegante(v).split("\n");
}

export function buildDetalheVehicleListRows(vehicleId: string): ShowcaseListRow[] {
  return [
    {
      id: vitrineButtonId("acao", `troca:${vehicleId}`),
      title: "🔄 Avaliar troca",
      description: "Avaliar meu carro na troca",
    },
    {
      id: vitrineButtonId("acao", `visita:${vehicleId}`),
      title: "📅 Agendar visita",
      description: "Agendar visita ou test drive",
    },
    {
      id: vitrineButtonId("acao", `financiamento:${vehicleId}`),
      title: "💰 Financiamento",
      description: "Simular financiamento deste carro",
    },
    {
      id: vitrineButtonId("consultor", vehicleId),
      title: "👤 Falar consultor",
      description: "Falar com um consultor humano",
    },
    {
      id: vitrineButtonId("interesse", vehicleId),
      title: "💬 Tenho interesse",
      description: "Quero saber mais sobre este carro",
    },
    {
      id: vitrineButtonId("acao", `proximo:${vehicleId}`),
      title: "➡️ Próximo carro",
      description: "Ver o próximo da lista",
    },
    {
      id: vitrineButtonId("acao", "inicio"),
      title: "⬅️ Voltar ao início",
      description: "Voltar ao menu de marcas e faixas",
    },
  ];
}

export function vehicleTitle(v: VeiculoVitrineRow): string {
  const base = vehicleDisplayTitle(v);
  const ano = formatAno(v);
  return ano && ano !== "—" ? `${base} ${ano}` : base;
}

export function buildRecadoInteresse(input: {
  clienteNome: string;
  contactName?: string | null;
  fromNumber: string;
  vehicle: VeiculoVitrineRow;
}): string {
  const titulo = vehicleTitle(input.vehicle);
  const preco = formatPrecoBrl(input.vehicle.preco);
  const clienteLine = formatRecadoClienteLine({
    clienteNome: input.clienteNome,
    contactName: input.contactName,
    fromNumber: input.fromNumber,
  });
  return [
    clienteLine,
    `Tem interesse no ${titulo} – ${preco}.`,
    `Veículo (estoque): ${input.vehicle.id}`,
    "Ação: retornar o contato do cliente.",
  ].join("\n");
}

export function buildRecadoConsultor(input: {
  clienteNome: string;
  contactName?: string | null;
  fromNumber: string;
  vehicle?: VeiculoVitrineRow | null;
  marca?: string | null;
}): string {
  const ctx = input.vehicle
    ? `${vehicleTitle(input.vehicle)} – ${formatPrecoBrl(input.vehicle.preco)}`
    : (input.marca ? `marca ${input.marca}` : "vitrine de veículos");
  const clienteLine = formatRecadoClienteLine({
    clienteNome: input.clienteNome,
    contactName: input.contactName,
    fromNumber: input.fromNumber,
  });
  return [
    clienteLine,
    `Pediu falar com consultor sobre ${ctx}.`,
    input.vehicle ? `Veículo (estoque): ${input.vehicle.id}` : null,
    "Ação: retornar o contato do cliente.",
  ].filter(Boolean).join("\n");
}

export function confirmacaoComNomeLoja(nomeEmpresa?: string | null): string {
  const nome = String(nomeEmpresa || "").trim() || "nossa loja";
  return `Perfeito! A equipe da ${nome} vai falar com você em instantes.`;
}

export const VITRINE_ACAO_EM_BREVE =
  "Essa opção será liberada em breve. Enquanto isso, toque em *Falar consultor* ou *Tenho interesse*.";

export const VITRINE_CAROUSEL_POST_DELAY_MS = 1500;

const TZ_SAO_PAULO = "America/Sao_Paulo";

export function normalizeVitrineText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
    .toLowerCase()
    .trim();
}

export function isVitrineFormControlText(
  text: string,
): "cancelar" | "consultor" | null {
  const value = normalizeVitrineText(text);
  if (!value) return null;
  if (/^(cancelar|cancela|sair|desistir)$/.test(value)) return "cancelar";
  if (
    /\b(falar com consultor|falar consultor|consultor humano|quero consultor)\b/.test(value)
  ) return "consultor";
  return null;
}

export function pendingFormIsActive(
  pending: PendingVitrineEstoque | null | undefined,
): pending is PendingVitrineEstoque & { form: VitrineEstoqueForm } {
  if (!pending?.form?.updated_at) return false;
  if (pending.form.flow === "cliente_nome") return true;
  return !!pending.form.veiculo_id;
}

export function pendingFormExpired(
  form: VitrineEstoqueForm,
  nowMs = Date.now(),
): boolean {
  const updated = Date.parse(form.updated_at);
  if (!Number.isFinite(updated)) return true;
  return nowMs - updated > VITRINE_FORM_TTL_MS;
}

/** Etapas da troca (Commit C) que capturam texto livre — visita não entra aqui. */
export function vitrineFormStepExpectsText(step: string): boolean {
  return step === "modelo_ano" || step === "km" || step === "placa" ||
    step === "observacoes";
}

export function vitrineFinanciamentoStepExpectsText(step: string): boolean {
  return [
    "nome_completo",
    "cpf_cnpj",
    "data_nascimento",
    "email",
    "cep",
    "numero",
    "complemento",
    "renda",
    "telefone_referencia",
    "entrada",
  ].includes(step);
}

export function shouldRunVitrineEarlyCapture(input: {
  userText: string;
  vitrineInteractiveId: string | null;
  pending: PendingVitrineEstoque | null | undefined;
}): boolean {
  if (input.vitrineInteractiveId) return true;
  if (!pendingFormIsActive(input.pending)) return false;
  if (pendingFormExpired(input.pending.form)) return false;
  if (isVitrineFormControlText(input.userText)) return true;
  if (
    input.pending.form.flow === "troca" &&
    vitrineFormStepExpectsText(input.pending.form.step)
  ) {
    return true;
  }
  if (
    input.pending.form.flow === "cliente_nome" &&
    input.pending.form.step === "nome"
  ) {
    return true;
  }
  if (
    input.pending.form.flow === "financiamento" &&
    vitrineFinanciamentoStepExpectsText(input.pending.form.step)
  ) {
    return true;
  }
  return false;
}

export function vitrineFormNeedsAudioTranscriptBeforeShowcase(
  pending: PendingVitrineEstoque | null | undefined,
): boolean {
  if (!pendingFormIsActive(pending)) return false;
  if (pendingFormExpired(pending.form)) return false;
  if (pending.form.flow === "cliente_nome" && pending.form.step === "nome") {
    return true;
  }
  if (
    pending.form.flow === "financiamento" &&
    vitrineFinanciamentoStepExpectsText(pending.form.step)
  ) {
    return true;
  }
  return pending.form.flow === "troca" &&
    vitrineFormStepExpectsText(pending.form.step);
}

/** Próximos N dias úteis a partir de AMANHÃ (exclui domingo). */
export function buildProximosDiasUteisVisita(
  count: number,
  nowMs = Date.now(),
  timeZone = TZ_SAO_PAULO,
): string[] {
  const out: string[] = [];
  const weekdayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const isoFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (let dayOffset = 1; out.length < count && dayOffset < 40; dayOffset++) {
    const instant = new Date(nowMs + dayOffset * 86_400_000);
    if (weekdayFmt.format(instant) === "Sun") continue;
    out.push(isoFmt.format(instant));
  }
  return out;
}

export function formatVisitaDiaLabel(
  isoDate: string,
  timeZone = TZ_SAO_PAULO,
): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const instant = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "short",
  }).format(instant);
  const dayMonth = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
  }).format(instant);
  return `${weekday} ${dayMonth}`.replace(/\./g, "");
}

export function buildVisitaDiaListRows(isoDates: string[]): ShowcaseListRow[] {
  return isoDates.map((iso) => ({
    id: vitrineButtonId("visita_dia", iso),
    title: formatVisitaDiaLabel(iso).slice(0, 24),
    description: "Escolher este dia",
  }));
}

export function parseIsoDateFromButtonParts(parts: string[]): string | null {
  if (parts.length >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    return isValidCalendarDate(parts[0]) ? parts[0] : null;
  }
  if (parts.length >= 3) {
    const iso = `${parts[0]}-${parts[1]}-${parts[2]}`;
    return isValidCalendarDate(iso) ? iso : null;
  }
  return null;
}

export function parseVisitaTurnoFromButtonParts(
  parts: string[],
): { iso: string; turno: VitrineVisitaTurno } | null {
  if (parts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    const turno = parts[1];
    if (turno !== "manha" && turno !== "tarde") return null;
    if (!isValidCalendarDate(parts[0])) return null;
    return { iso: parts[0], turno };
  }
  if (parts.length >= 4) {
    const iso = parseIsoDateFromButtonParts(parts.slice(0, 3));
    const turno = parts[3];
    if (!iso || (turno !== "manha" && turno !== "tarde")) return null;
    return { iso, turno };
  }
  return null;
}

export function visitaTurnoLabel(turno: VitrineVisitaTurno): string {
  return turno === "manha" ? "manhã" : "tarde";
}

export function buildRecadoVisita(input: {
  clienteNome: string;
  contactName?: string | null;
  fromNumber: string;
  vehicle: VeiculoVitrineRow;
  diaIso: string;
  turno: VitrineVisitaTurno;
}): string {
  const titulo = vehicleTitle(input.vehicle);
  const clienteLine = formatRecadoClienteLine({
    clienteNome: input.clienteNome,
    contactName: input.contactName,
    fromNumber: input.fromNumber,
  });
  return [
    clienteLine,
    "Quer agendar visita/test drive.",
    `Veículo: ${titulo} (id ${input.vehicle.id})`,
    `Dia: ${formatVisitaDiaLabel(input.diaIso)} (${input.diaIso})`,
    `Turno: ${visitaTurnoLabel(input.turno)}`,
    "Ação: confirmar horário com o cliente.",
  ].join("\n");
}

export function buildRecadoFinanciamento(input: {
  clienteNome: string;
  contactName?: string | null;
  fromNumber: string;
  vehicle: VeiculoVitrineRow;
}): string {
  const titulo = vehicleTitle(input.vehicle);
  const clienteLine = formatRecadoClienteLine({
    clienteNome: input.clienteNome,
    contactName: input.contactName,
    fromNumber: input.fromNumber,
  });
  return [
    clienteLine,
    `Quer simular financiamento do ${titulo}.`,
    `Veículo (estoque): ${input.vehicle.id}`,
    "Ação: retornar contato com simulação.",
  ].join("\n");
}

export function buildRecadoFormCancelado(input: {
  clienteNome: string;
  contactName?: string | null;
  fromNumber: string;
  vehicle?: VeiculoVitrineRow | null;
  form: VitrineEstoqueForm;
}): string {
  const titulo = input.vehicle ? vehicleTitle(input.vehicle) : input.form.veiculo_id;
  const clienteLine = formatRecadoClienteLine({
    clienteNome: input.clienteNome,
    contactName: input.contactName,
    fromNumber: input.fromNumber,
  });
  const extras: string[] = [];
  if (input.form.dia_iso) {
    extras.push(`Dia escolhido: ${formatVisitaDiaLabel(input.form.dia_iso)}`);
  }
  if (input.form.turno) extras.push(`Turno: ${visitaTurnoLabel(input.form.turno)}`);
  return [
    clienteLine,
    `Cancelou/saiu de um fluxo da vitrine (${input.form.flow}, etapa ${input.form.step}).`,
    `Veículo: ${titulo}`,
    ...extras,
    "Ação: retomar contato se fizer sentido.",
  ].join("\n");
}

export function confirmacaoVisitaAgendada(
  nomeEmpresa: string | null | undefined,
  diaIso: string,
  turno: VitrineVisitaTurno,
): string {
  const nome = String(nomeEmpresa || "").trim() || "nossa loja";
  return `Visita agendada com a ${nome}! Te esperamos ${formatVisitaDiaLabel(diaIso)}, período da ${visitaTurnoLabel(turno)}. Nosso consultor vai entrar em contato em breve para confirmar. 😊`;
}

export function confirmacaoFinanciamento(
  nomeEmpresa: string | null | undefined,
): string {
  const nome = String(nomeEmpresa || "").trim() || "nossa loja";
  return `Obrigado! A ${nome} recebeu seu pedido de simulação de financiamento. Um consultor retorna em instantes.`;
}

export function pendingIsActive(
  pending: PendingVitrineEstoque | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!pending?.updated_at) return false;
  const updated = Date.parse(pending.updated_at);
  if (!Number.isFinite(updated)) return false;
  return nowMs - updated <= 30 * 60 * 1000;
}

export function shouldEnterShowcase(input: {
  flags: VehicleShowcaseTenantFlags;
  explicitText: boolean;
  vitrineInteractiveId: string | null;
}): boolean {
  if (!shouldOfferVehicleShowcase(input.flags)) return false;
  if (input.vitrineInteractiveId) return true;
  if (!input.explicitText) return false;
  if (isAutomotiveTenant(input.flags.segmento)) return true;
  if (input.flags.vitrine_veiculos_demo) return true;
  return false;
}

export const VITRINE_CAROUSEL_PAGE_SIZE = 10;
