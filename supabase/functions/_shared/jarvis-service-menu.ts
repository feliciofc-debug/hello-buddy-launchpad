import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  type GestaoAuthContext,
  isGestaoAuthorizedPhone,
  loadGestaoAuthContext,
} from "./gestao-auth-phone.ts";
import {
  formatarRespostaJarvisAjuda,
  JARVIS_AJUDA_CATALOGO,
  JARVIS_MENU_LISTS,
  type JarvisAjudaItem,
  type JarvisMenuAudience,
  type JarvisMenuList,
} from "./jarvis-ajuda-catalogo.ts";
import { jarvisMenuRows } from "./jarvis-menu-tree.ts";
import { ownerPhoneVariants } from "./owner-phone.ts";
import { isAutomotiveTenant } from "./vertical-router.ts";

export const JARVIS_MENU_ID_PREFIX = "jarvis_menu:";
const MENU_PENDING_TTL_MS = 2 * 60 * 60 * 1000;

export type JarvisMenuSkipReason =
  | "flag_off"
  | "nao_saudacao"
  | `pendencia:${string}`
  | "midia"
  | "sem_acesso";

export type JarvisMenuConfig = {
  menu_enabled: boolean;
  vendedor_enabled: boolean;
  recent_enabled: boolean;
};

export type JarvisMenuRole = JarvisMenuAudience;

export type JarvisMenuInteractiveButtons = {
  body: string;
  buttons: Array<{ id: string; title: string }>;
};

export type JarvisMenuInteractiveList = {
  body: string;
  button: string;
  section_title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
};

export type JarvisServiceMenuResult =
  | { handled: false }
  | {
    handled: true;
    role: JarvisMenuRole;
    kind: "greeting" | "list" | "item";
    text: string;
    interactiveButtons?: JarvisMenuInteractiveButtons;
    interactiveList?: JarvisMenuInteractiveList;
    clearedAgentState?: Record<string, unknown>;
  };

export type JarvisServiceMenuInput = {
  sb: SupabaseClient;
  userId: string;
  fromNumber: string;
  text: string;
  messageType: string | null | undefined;
  isOwner: boolean;
  displayName?: string | null;
  hasBlockingMedia?: boolean;
  priorityFlowActive?: boolean;
  partnerQuoteActive?: boolean;
  humanHandoffActive?: boolean;
  agentState?: Record<string, unknown> | null;
  lastMessageAt?: string | null;
  tenantSegment?: string | null;
  appBaseUrl?: string | null;
  now?: Date;
};

export type JarvisServiceMenuDependencies = {
  loadConfig?: (
    sb: SupabaseClient,
    userId: string,
  ) => Promise<JarvisMenuConfig | null>;
  loadAuthContext?: (
    sb: SupabaseClient,
    userId: string,
  ) => Promise<GestaoAuthContext>;
  isActiveSeller?: (
    sb: SupabaseClient,
    userId: string,
    fromNumber: string,
  ) => Promise<boolean>;
  logSkip?: (reason: JarvisMenuSkipReason) => void;
};

function normalizeGreeting(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GREETING_PREFIXES = [
  "bom dia",
  "boa tarde",
  "boa noite",
  "e ai",
  "eai",
  "eae",
  "hello",
  "hey",
  "salve",
  "fala",
  "ola",
  "opa",
  "oi",
] as const;

const JARVIS_CALL_NAMES = [
  "jarvis",
  "jarvir",
  "jarvs",
  "javis",
  "jarbis",
  "jervis",
] as const;

const COURTESY_PHRASES = [
  "bora trabalhar",
  "tudo certo",
  "meu amigo",
  "parceiro",
  "como vai",
  "td bem",
  "tudo bem",
  "tudo bom",
  "beleza",
  "blz",
  "firmeza",
  "amigo",
  "chefe",
] as const;

const REQUEST_KEYWORDS = [
  "anunciar",
  "anuncio",
  "postar",
  "posta",
  "publicar",
  "agendar",
  "foto",
  "video",
  "arte",
  "logo",
  "placa",
  "estoque",
  "vistoria",
  "troca",
  "laudo",
  "soma",
  "somar",
  "conta",
  "preco",
  "valor",
  "quanto",
  "fipe",
  "molicar",
  "procedencia",
  "documento",
  "crlv",
  "cotacao",
  "oficina",
  "servico",
  "cliente",
  "venda",
  "relatorio",
  "quero",
  "preciso",
  "pode",
  "faz",
  "manda",
  "mostra",
  "mostrar",
  "corolla",
  "civic",
  "menu",
  "ajuda",
] as const;

const PLATE_RE =
  /\b([A-Z]{3}[-\s]?[0-9][A-Z0-9]?[-\s]?[0-9]{2})\b/i;

function profileCallingPhrases(displayName?: string | null): string[] {
  const normalized = normalizeGreeting(displayName || "");
  if (!normalized) return [];
  const first = normalized.split(" ")[0];
  return [...new Set([normalized, first])].filter(Boolean);
}

function applyGreetingTypoFixes(value: string): string {
  return value
    .replace(/\bbom dai\b/g, "bom dia")
    .replace(/\bboa tade\b/g, "boa tarde")
    .replace(/\bboa noit\b/g, "boa noite")
    .replace(/\boie\b/g, "oi")
    .replace(/\b(jarvir|jarvs|javis|jarbis|jervis)\b/g, "jarvis");
}

function isOiVariant(token: string): boolean {
  return /^o+i+e?$/i.test(token);
}

function stripLeadingPrefix(
  value: string,
  prefix: string,
): string | null {
  if (value === prefix) return "";
  if (value.startsWith(`${prefix} `)) return value.slice(prefix.length + 1);
  return null;
}

function consumeGreetingStart(value: string): {
  rest: string;
  foundGreeting: boolean;
} | null {
  let rest = value;
  let foundGreeting = false;
  for (;;) {
    let matched = false;
    for (const prefix of GREETING_PREFIXES) {
      const next = stripLeadingPrefix(rest, prefix);
      if (next != null) {
        rest = next;
        foundGreeting = true;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const token = rest.split(" ")[0] ?? "";
    if (isOiVariant(token)) {
      rest = rest.slice(token.length).trimStart();
      foundGreeting = true;
      continue;
    }
    break;
  }
  return foundGreeting ? { rest, foundGreeting } : null;
}

function allowedTailPhrases(displayName?: string | null): string[] {
  return [
    ...COURTESY_PHRASES,
    ...JARVIS_CALL_NAMES,
    ...profileCallingPhrases(displayName),
  ].sort((a, b) => b.length - a.length);
}

function hasSpecificRequest(raw: string, normalized: string): boolean {
  if (PLATE_RE.test(raw)) return true;
  if (/\d/.test(normalized)) return true;
  for (const keyword of REQUEST_KEYWORDS) {
    const re = new RegExp(`\\b${keyword}\\b`, "i");
    if (re.test(normalized)) return true;
  }
  if (/\?/.test(normalized)) {
    const courtesyOnly = /^(?:tudo certo|tudo bem|tudo bom|como vai|beleza|blz|td bem)(?:\s+\?)?$/
      .test(normalized) ||
      COURTESY_PHRASES.some((phrase) =>
        normalized.includes(phrase) &&
        !REQUEST_KEYWORDS.some((kw) => normalized.includes(kw))
      );
    if (!courtesyOnly && /\btem\b|\bquanto\b|\bqual\b|\bcomo\b|\bonde\b/.test(
      normalized,
    )) {
      return true;
    }
  }
  if (/\btem\b/.test(normalized) && normalized.length > 12) return true;
  if (/^(menu|ajuda|o que voce faz|o que você faz)/.test(normalized)) {
    return true;
  }
  return false;
}

function isCourtesyOnly(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return COURTESY_PHRASES.some((phrase) =>
    trimmed === phrase || trimmed.startsWith(`${phrase} `)
  );
}

function isCallOnly(value: string, displayName?: string | null): boolean {
  const allowed = new Set([
    ...JARVIS_CALL_NAMES,
    "chefe",
    "amigo",
    "parceiro",
    ...profileCallingPhrases(displayName),
  ]);
  const tokens = value.split(" ").filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => allowed.has(token));
}

export function isJarvisPureGreeting(
  value: string,
  displayName?: string | null,
): boolean {
  if ([...String(value || "").trim()].length > 60) return false;
  const raw = String(value || "").trim();
  if (!raw || raw === "👋") return false;
  const normalized = applyGreetingTypoFixes(normalizeGreeting(raw));
  if (!normalized) return false;
  if (hasSpecificRequest(raw, normalized)) return false;

  if (isCallOnly(normalized, displayName)) return true;
  if (isCourtesyOnly(normalized)) return true;

  const start = consumeGreetingStart(normalized);
  if (!start) return false;

  let remaining = start.rest;
  const tailPhrases = allowedTailPhrases(displayName);
  while (remaining) {
    const again = consumeGreetingStart(remaining);
    if (again) {
      remaining = again.rest;
      continue;
    }
    const phrase = tailPhrases.find((candidate) =>
      remaining === candidate || remaining.startsWith(`${candidate} `)
    );
    if (!phrase) return false;
    remaining = remaining.slice(phrase.length).trimStart();
  }
  return true;
}

export function extractJarvisMenuId(value: string): string | null {
  const raw = String(value || "").trim();
  if (raw.toLowerCase().startsWith(JARVIS_MENU_ID_PREFIX)) return raw;
  const marker = raw.match(
    /<<INTERACTIVE_ID:(jarvis_menu:[^>]+)>>/i,
  )?.[1];
  return marker?.trim() ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pendingTimestamp(value: unknown): number | null {
  if (!isRecord(value)) return null;
  for (
    const field of [
      "created_at",
      "criado_em",
      "updated_at",
      "at",
      "last_photo_at",
      "started_at",
      "requested_at",
    ]
  ) {
    const parsed = Date.parse(String(value[field] ?? ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pendingIsRecent(
  value: unknown,
  nowMs: number,
  fallbackTimestamp: number | null,
): boolean {
  const timestamp = pendingTimestamp(value) ?? fallbackTimestamp;
  return timestamp != null && nowMs - timestamp < MENU_PENDING_TTL_MS;
}

function bucketPendingName(
  bucket: Record<string, unknown>,
  nowMs: number,
  fallbackTimestamp: number | null,
): string | null {
  for (const [key, value] of Object.entries(bucket)) {
    if (
      key.startsWith("pending_") &&
      value != null &&
      value !== false &&
      pendingIsRecent(value, nowMs, fallbackTimestamp)
    ) {
      return key;
    }
  }
  return null;
}

const GREETING_PRESERVED_PENDING = new Set([
  "pending_gestao_confirm",
  "pending_procedencia_confirm",
]);

function removeMediaMarketingPending(
  bucket: Record<string, unknown>,
  preserveFinancial = false,
): boolean {
  let changed = false;
  for (const key of Object.keys(bucket)) {
    if (
      key.startsWith("pending_") &&
      !(preserveFinancial && GREETING_PRESERVED_PENDING.has(key))
    ) {
      delete bucket[key];
      changed = true;
    }
  }
  return changed;
}

export function clearJarvisGreetingPendingState(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!input) return null;
  const hiddenRoot = (input as Record<string, unknown>).__vertical_root;
  const source = isRecord(hiddenRoot) ? hiddenRoot : input;
  const next = structuredClone(source);
  let changed = removeMediaMarketingPending(next, true);
  for (const key of ["vehicle", "general", "vertical_router"]) {
    const bucket = next[key];
    if (isRecord(bucket)) {
      changed = removeMediaMarketingPending(bucket) || changed;
    }
  }
  if (!changed) return null;

  removeMediaMarketingPending(input, true);
  for (const key of ["vehicle", "general", "vertical_router"]) {
    const bucket = input[key];
    if (isRecord(bucket)) removeMediaMarketingPending(bucket);
  }
  if (isRecord(hiddenRoot)) {
    for (const key of Object.keys(hiddenRoot)) delete hiddenRoot[key];
    Object.assign(hiddenRoot, next);
  }
  return next;
}

function pendingConfirmationSummary(
  state: Record<string, unknown> | null | undefined,
): string | null {
  if (!state) return null;
  const gestao = state.pending_gestao_confirm;
  if (isRecord(gestao)) {
    const action = String(gestao.action ?? "")
      .replace(/_/g, " ")
      .trim();
    return action
      ? `confirmação de gestão (${action})`
      : "confirmação de gestão";
  }
  const procedencia = state.pending_procedencia_confirm;
  if (isRecord(procedencia)) {
    const plate = String(procedencia.placa ?? "").trim();
    return plate
      ? `consulta de procedência da placa ${plate}`
      : "consulta de procedência";
  }
  return null;
}

export function jarvisMenuPriorityPendingName(
  state: Record<string, unknown> | null | undefined,
  options: { now?: Date; lastMessageAt?: string | null } = {},
): string | null {
  if (!state) return null;
  const nowMs = (options.now ?? new Date()).getTime();
  const parsedFallback = Date.parse(String(options.lastMessageAt ?? ""));
  const fallbackTimestamp = Number.isFinite(parsedFallback)
    ? parsedFallback
    : null;
  const rootPending = bucketPendingName(state, nowMs, fallbackTimestamp);
  if (rootPending) return rootPending;
  for (const key of ["vehicle", "general", "vertical_router"]) {
    const bucket = state[key];
    if (!isRecord(bucket)) continue;
    const nestedPending = bucketPendingName(
      bucket,
      nowMs,
      fallbackTimestamp,
    );
    if (nestedPending) return nestedPending;
  }
  return null;
}

export function hasJarvisMenuPriorityPending(
  state: Record<string, unknown> | null | undefined,
  options: { now?: Date; lastMessageAt?: string | null } = {},
): boolean {
  return jarvisMenuPriorityPendingName(state, options) != null;
}

async function loadJarvisMenuConfig(
  sb: SupabaseClient,
  userId: string,
): Promise<JarvisMenuConfig | null> {
  const { data, error } = await sb.from("jarvis_menu_config")
    .select("menu_enabled,vendedor_enabled,recent_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    menu_enabled: data.menu_enabled === true,
    vendedor_enabled: data.vendedor_enabled === true,
    recent_enabled: data.recent_enabled !== false,
  };
}

async function isActiveGestaoSeller(
  sb: SupabaseClient,
  userId: string,
  fromNumber: string,
): Promise<boolean> {
  const { data, error } = await sb.from("gestao_vendedores")
    .select("whatsapp_e164")
    .eq("user_id", userId)
    .eq("ativo", true);
  if (error) return false;
  const sender = new Set(ownerPhoneVariants(fromNumber));
  return (data ?? []).some((row) =>
    ownerPhoneVariants(String(row.whatsapp_e164 ?? "")).some((phone) =>
      sender.has(phone)
    )
  );
}

export async function resolveJarvisMenuRole(
  input: Pick<
    JarvisServiceMenuInput,
    "sb" | "userId" | "fromNumber" | "isOwner"
  >,
  config: JarvisMenuConfig,
  dependencies: JarvisServiceMenuDependencies = {},
): Promise<JarvisMenuRole | null> {
  if (input.isOwner) return "owner";
  try {
    const auth = await (dependencies.loadAuthContext ?? loadGestaoAuthContext)(
      input.sb,
      input.userId,
    );
    if (isGestaoAuthorizedPhone(input.fromNumber, auth)) return "manager";
  } catch {
    return null;
  }
  if (!config.vendedor_enabled) return null;
  try {
    const seller = await (
      dependencies.isActiveSeller ?? isActiveGestaoSeller
    )(input.sb, input.userId, input.fromNumber);
    return seller ? "seller" : null;
  } catch {
    return null;
  }
}

function saoPauloHour(now: Date): number {
  const hour = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
}

function greetingPeriod(hour: number): "Bom dia" | "Boa tarde" | "Boa noite" {
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

function firstName(value: string | null | undefined): string {
  return String(value || "").trim().split(/\s+/)[0] || "você";
}

function rootListsForRole(role: JarvisMenuRole): JarvisMenuList[] {
  return JARVIS_MENU_LISTS.filter((list) =>
    !list.parentId && list.audiences.includes(role)
  ).sort((a, b) => a.order - b.order);
}

function rootButtons(
  role: JarvisMenuRole,
): JarvisMenuInteractiveButtons["buttons"] {
  return rootListsForRole(role).map((list) => ({
    id: `${JARVIS_MENU_ID_PREFIX}grupo:${list.id}`,
    title: list.title,
  }));
}

function listAccessible(list: JarvisMenuList, role: JarvisMenuRole): boolean {
  return list.audiences.includes(role);
}

function itemAccessible(item: JarvisAjudaItem, role: JarvisMenuRole): boolean {
  return item.menu.visible && item.menu.audiences.includes(role);
}

function renderMenuList(
  list: JarvisMenuList,
  role: JarvisMenuRole,
  tenantSegment?: string | null,
): JarvisMenuInteractiveList {
  const rows = jarvisMenuRows(list.id).filter((row) => {
    if (row.kind === "recent") return false;
    if (row.kind === "list") return listAccessible(row.list!, role);
    if (row.kind === "item") return itemAccessible(row.item!, role);
    const parent = JARVIS_MENU_LISTS.find((candidate) =>
      candidate.id === list.parentId
    );
    return !parent || listAccessible(parent, role);
  }).map((row) => {
    if (row.kind === "list") {
      return {
        id: `${JARVIS_MENU_ID_PREFIX}lista:${row.list!.id}`,
        title: row.title,
        description: row.description,
      };
    }
    if (row.kind === "back") {
      return {
        id: `${JARVIS_MENU_ID_PREFIX}lista:${list.parentId}`,
        title: row.title,
        description: row.description,
      };
    }
    return {
      id: `${JARVIS_MENU_ID_PREFIX}item:${row.item!.id}`,
      title: row.title,
      description: row.description,
    };
  });
  const body = list.id === "marketing:postar_redes" &&
      isAutomotiveTenant(tenantSegment)
    ? [
      "O que vamos divulgar hoje?",
      '1. Um carro do estoque (ex: "Posta o Corolla 2022")',
      "2. A última foto ou vídeo que você me mandou",
      '3. Um texto ou ideia (ex: "feirão de sábado", "carro recém-chegado")',
    ].join("\n")
    : `${list.title}\nEscolha uma opção.`;
  return {
    body,
    button: "Ver opções",
    section_title: "Serviços",
    rows,
  };
}

function absolutePanelUrl(
  href: string,
  appBaseUrl: string | null | undefined,
): string {
  if (/^https?:\/\//i.test(href)) return href;
  const base = String(appBaseUrl || "").replace(/\/+$/, "");
  return base ? `${base}${href.startsWith("/") ? href : `/${href}`}` : href;
}

function itemResponse(
  item: JarvisAjudaItem,
  appBaseUrl: string | null | undefined,
): string {
  const base = formatarRespostaJarvisAjuda(item);
  if (item.route.type !== "panel") return base;
  return [
    base,
    "",
    `🔗 ${absolutePanelUrl(item.route.href, appBaseUrl)}`,
    `Caminho: ${item.route.path}`,
  ].join("\n");
}

function parseNavigation(
  menuId: string,
): { kind: "grupo" | "lista" | "item"; id: string } | null {
  const match = menuId.match(/^jarvis_menu:(grupo|lista|item):(.+)$/i);
  if (!match) return null;
  return {
    kind: match[1].toLowerCase() as "grupo" | "lista" | "item",
    id: match[2],
  };
}

function messageTypeAllowed(messageType: string | null | undefined): boolean {
  return ["text", "interactive", "audio"].includes(
    String(messageType || "").toLowerCase(),
  );
}

function defaultLogSkip(reason: JarvisMenuSkipReason): void {
  console.log("[jarvis-service-menu] skip", reason);
}

export async function tryProcessJarvisServiceMenu(
  input: JarvisServiceMenuInput,
  dependencies: JarvisServiceMenuDependencies = {},
): Promise<JarvisServiceMenuResult> {
  const menuId = extractJarvisMenuId(input.text);
  const isGreeting = isJarvisPureGreeting(input.text, input.displayName);
  const requestedMenu = Boolean(menuId || isGreeting);
  const logSkip = dependencies.logSkip ?? defaultLogSkip;

  let config: JarvisMenuConfig | null = null;
  try {
    config = await (dependencies.loadConfig ?? loadJarvisMenuConfig)(
      input.sb,
      input.userId,
    );
  } catch {
    config = null;
  }

  const role = await resolveJarvisMenuRole(
    input,
    config ?? {
      menu_enabled: false,
      vendedor_enabled: false,
      recent_enabled: true,
    },
    dependencies,
  );
  const diagnosticAuthorized = role === "owner" || role === "manager";
  if (!config?.menu_enabled) {
    if (diagnosticAuthorized) logSkip("flag_off");
    return { handled: false };
  }
  if (!role) {
    if (requestedMenu) logSkip("sem_acesso");
    return { handled: false };
  }
  if (!requestedMenu) {
    if (diagnosticAuthorized) logSkip("nao_saudacao");
    return { handled: false };
  }
  if (!messageTypeAllowed(input.messageType) || input.hasBlockingMedia) {
    if (diagnosticAuthorized) logSkip("midia");
    return { handled: false };
  }
  if (input.partnerQuoteActive || input.humanHandoffActive) {
    if (diagnosticAuthorized) logSkip("pendencia:fluxo_prioritario");
    return { handled: false };
  }
  if (input.priorityFlowActive && !isGreeting) {
    if (diagnosticAuthorized) logSkip("pendencia:fluxo_prioritario");
    return { handled: false };
  }
  if (!isGreeting) {
    const pendingName = jarvisMenuPriorityPendingName(input.agentState, {
      now: input.now,
      lastMessageAt: input.lastMessageAt,
    });
    if (pendingName) {
      if (diagnosticAuthorized) logSkip(`pendencia:${pendingName}`);
      return { handled: false };
    }
  }

  if (!menuId) {
    const now = input.now ?? new Date();
    const greeting = greetingPeriod(saoPauloHour(now));
    const baseText = `${greeting}, ${
      firstName(input.displayName)
    }! Como posso te ajudar?`;
    const confirmation = pendingConfirmationSummary(input.agentState);
    const text = confirmation
      ? `${baseText}\nVocê tem uma confirmação pendente: ${confirmation}.`
      : baseText;
    const clearedAgentState = clearJarvisGreetingPendingState(
      input.agentState,
    );
    return {
      handled: true,
      role,
      kind: "greeting",
      text,
      interactiveButtons: {
        body: text,
        buttons: rootButtons(role),
      },
      ...(clearedAgentState ? { clearedAgentState } : {}),
    };
  }

  const navigation = parseNavigation(menuId);
  if (!navigation) {
    if (diagnosticAuthorized) logSkip("nao_saudacao");
    return { handled: false };
  }
  if (navigation.kind === "item") {
    const item = JARVIS_AJUDA_CATALOGO.find((candidate) =>
      candidate.id === navigation.id
    );
    if (!item || !itemAccessible(item, role)) {
      if (diagnosticAuthorized) logSkip("sem_acesso");
      return { handled: false };
    }
    return {
      handled: true,
      role,
      kind: "item",
      text: itemResponse(item, input.appBaseUrl),
    };
  }

  const list = JARVIS_MENU_LISTS.find((candidate) =>
    candidate.id === navigation.id
  );
  if (
    !list ||
    !listAccessible(list, role) ||
    (navigation.kind === "grupo" && list.parentId !== null)
  ) {
    if (diagnosticAuthorized) logSkip("sem_acesso");
    return { handled: false };
  }
  const interactiveList = renderMenuList(list, role, input.tenantSegment);
  return {
    handled: true,
    role,
    kind: "list",
    text: interactiveList.body,
    interactiveList,
  };
}
