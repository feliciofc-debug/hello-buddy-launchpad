import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  type GestaoAuthContext,
  isGestaoAuthorizedPhone,
  loadGestaoAuthContext,
} from "./gestao-auth-phone.ts";
import {
  buildGestaoFechamentoDia,
  type GestaoFechamentoDia,
} from "./gestao-fechamento-dia.ts";
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
import { dateKeySaoPaulo } from "./vitrine-crm-time.ts";

export const JARVIS_MENU_ID_PREFIX = "jarvis_menu:";
const MENU_CACHE_TTL_MS = 10 * 60 * 1000;

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
  agentState?: Record<string, unknown> | null;
  appBaseUrl?: string | null;
  now?: Date;
};

type FechamentoBuilder = typeof buildGestaoFechamentoDia;

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
  buildFechamento?: FechamentoBuilder;
};

type GreetingSnapshot = {
  summary: string;
  urgentCount: number;
};

const greetingCache = new Map<
  string,
  { expiresAt: number; value: GreetingSnapshot }
>();

function normalizeGreeting(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PURE_GREETINGS = new Set([
  "oi",
  "ola",
  "oi jarvis",
  "bom dia",
  "boa tarde",
  "boa noite",
  "e ai",
  "menu",
  "opcoes",
  "o que voce faz",
]);

export function isJarvisPureGreeting(value: string): boolean {
  return PURE_GREETINGS.has(normalizeGreeting(value));
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

function bucketHasPending(bucket: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(bucket)) {
    if (key.startsWith("pending_") && value != null && value !== false) {
      return true;
    }
  }
  return false;
}

export function hasJarvisMenuPriorityPending(
  state: Record<string, unknown> | null | undefined,
): boolean {
  if (!state) return false;
  if (bucketHasPending(state)) return true;
  for (const key of ["vehicle", "general", "vertical_router"]) {
    const bucket = state[key];
    if (isRecord(bucket) && bucketHasPending(bucket)) return true;
  }
  return false;
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

function previousYmd(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 1, 12));
  return date.toISOString().slice(0, 10);
}

function moneyWithoutNbsp(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).replace(/[\u00a0\u202f]/g, " ");
}

export function formatJarvisGreetingSummary(
  dados: GestaoFechamentoDia,
  label: "Ontem" | "Hoje",
): string {
  const overdue = dados.financeiro?.contasVencidas ?? 0;
  return `${label}: ${dados.vendasHoje.qtd} vendas · parado ${
    moneyWithoutNbsp(dados.custoEstoque.hoje ?? 0)
  } · ${overdue} contas vencidas`;
}

function greetingPeriod(hour: number): {
  greeting: "Bom dia" | "Boa tarde" | "Boa noite";
  summaryLabel: "Ontem" | "Hoje";
} {
  return {
    greeting: hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite",
    summaryLabel: hour < 12 ? "Ontem" : "Hoje",
  };
}

function firstName(value: string | null | undefined): string {
  return String(value || "").trim().split(/\s+/)[0] || "você";
}

async function loadGreetingSnapshot(
  input: JarvisServiceMenuInput,
  dependencies: JarvisServiceMenuDependencies,
): Promise<GreetingSnapshot> {
  const now = input.now ?? new Date();
  const today = dateKeySaoPaulo(now);
  const hour = saoPauloHour(now);
  const { summaryLabel } = greetingPeriod(hour);
  const cacheKey = `${input.userId}:${today}:${summaryLabel.toLowerCase()}`;
  const cached = greetingCache.get(cacheKey);
  if (cached && cached.expiresAt > now.getTime()) return cached.value;

  const targetDay = summaryLabel === "Ontem" ? previousYmd(today) : today;
  const builder = dependencies.buildFechamento ?? buildGestaoFechamentoDia;
  let summary = "Não consegui carregar o resumo agora.";
  let urgentCount = 0;
  try {
    const summaryResult = await builder(input.sb, input.userId, targetDay, {
      financeiroPermitido: true,
    });
    summary = formatJarvisGreetingSummary(summaryResult.dados, summaryLabel);
    if (targetDay === today) {
      urgentCount = summaryResult.dados.acoes.length;
    }
  } catch {
    // O menu continua disponível com o fallback explícito.
  }
  if (targetDay !== today) {
    try {
      const todayResult = await builder(input.sb, input.userId, today, {
        financeiroPermitido: true,
      });
      urgentCount = todayResult.dados.acoes.length;
    } catch {
      urgentCount = 0;
    }
  }
  const value = { summary, urgentCount };
  greetingCache.set(cacheKey, {
    expiresAt: now.getTime() + MENU_CACHE_TTL_MS,
    value,
  });
  return value;
}

export function clearJarvisServiceMenuCacheForTests(): void {
  greetingCache.clear();
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
  return {
    body: `${list.title}\nEscolha uma opção.`,
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

export async function tryProcessJarvisServiceMenu(
  input: JarvisServiceMenuInput,
  dependencies: JarvisServiceMenuDependencies = {},
): Promise<JarvisServiceMenuResult> {
  const menuId = extractJarvisMenuId(input.text);
  if (!menuId && !isJarvisPureGreeting(input.text)) {
    return { handled: false };
  }
  if (
    !messageTypeAllowed(input.messageType) ||
    input.hasBlockingMedia ||
    input.priorityFlowActive ||
    hasJarvisMenuPriorityPending(input.agentState)
  ) {
    return { handled: false };
  }

  let config: JarvisMenuConfig | null = null;
  try {
    config = await (dependencies.loadConfig ?? loadJarvisMenuConfig)(
      input.sb,
      input.userId,
    );
  } catch {
    return { handled: false };
  }
  if (!config?.menu_enabled) return { handled: false };

  const role = await resolveJarvisMenuRole(input, config, dependencies);
  if (!role) return { handled: false };

  if (!menuId) {
    const now = input.now ?? new Date();
    const { greeting } = greetingPeriod(saoPauloHour(now));
    const lines = [`${greeting}, ${firstName(input.displayName)}.`];
    if (role !== "seller") {
      const snapshot = await loadGreetingSnapshot(input, dependencies);
      lines.push(snapshot.summary);
      if (snapshot.urgentCount > 0) {
        lines.push(
          `⚠️ ${snapshot.urgentCount} ${
            snapshot.urgentCount === 1 ? "urgente" : "urgentes"
          } para decidir hoje.`,
        );
      }
    }
    lines.push("", "Ou me diga (ou mande um áudio) o que precisa.");
    const text = lines.join("\n");
    return {
      handled: true,
      role,
      kind: "greeting",
      text,
      interactiveButtons: {
        body: text,
        buttons: rootButtons(role),
      },
    };
  }

  const navigation = parseNavigation(menuId);
  if (!navigation) return { handled: false };
  if (navigation.kind === "item") {
    const item = JARVIS_AJUDA_CATALOGO.find((candidate) =>
      candidate.id === navigation.id
    );
    if (!item || !itemAccessible(item, role)) return { handled: false };
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
    return { handled: false };
  }
  const interactiveList = renderMenuList(list, role);
  return {
    handled: true,
    role,
    kind: "list",
    text: interactiveList.body,
    interactiveList,
  };
}
