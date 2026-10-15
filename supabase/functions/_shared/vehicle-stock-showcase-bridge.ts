import {
  runVehicleStockShowcaseTurn,
  ShowcaseSendResult,
  ShowcaseTurnDeps,
  VEHICLE_SELECT,
} from "./vehicle-stock-showcase-turn.ts";
import {
  FaixaPrecoId,
  PendingVitrineEstoque,
  VehicleShowcaseTenantFlags,
  VeiculoVitrineRow,
} from "./vehicle-stock-whatsapp.ts";

export type ShowcaseBridgeContext = {
  sb: any;
  userId: string;
  to: string;
  contactName?: string | null;
  supabaseUrl: string;
  serviceKey: string;
  agentState: Record<string, unknown>;
  loadAgentState: () => Promise<Record<string, unknown>>;
  saveAgentStatePatch: (
    patch: Record<string, unknown>,
    current: Record<string, unknown>,
  ) => Promise<boolean>;
  encaminharRecado: (recado: string) => Promise<{ ok: boolean; protocolo?: string }>;
};

async function postSendMessage(
  ctx: ShowcaseBridgeContext,
  body: Record<string, unknown>,
): Promise<ShowcaseSendResult> {
  const res = await fetch(`${ctx.supabaseUrl}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.serviceKey}`,
      apikey: ctx.serviceKey,
    },
    body: JSON.stringify({ user_id: ctx.userId, to: ctx.to, skip_log: true, ...body }),
  });
  const txt = await res.text();
  let parsed: any = {};
  try {
    parsed = JSON.parse(txt);
  } catch {
    parsed = { error: txt.slice(0, 200) };
  }
  if (parsed?.carousel_rejected) {
    return {
      ok: false,
      httpStatus: parsed.http_status,
      metaError: parsed.meta_error,
    };
  }
  if (!res.ok || parsed?.success !== true) {
    return {
      ok: false,
      httpStatus: res.status,
      metaError: parsed?.error ?? parsed,
    };
  }
  return { ok: true, messageId: parsed.message_id ?? null };
}

export function getPendingVitrineEstoque(
  state: Record<string, unknown>,
): PendingVitrineEstoque | null {
  const vehicle = state.vehicle as Record<string, unknown> | undefined;
  const pending = vehicle?.pending_vitrine_estoque as PendingVitrineEstoque | undefined;
  return pending ?? null;
}

function pendingFromState(state: Record<string, unknown>): PendingVitrineEstoque | null {
  return getPendingVitrineEstoque(state);
}

function faixaQuery(sb: any, userId: string, faixa: FaixaPrecoId) {
  let q = sb.from("veiculos_estoque")
    .select(VEHICLE_SELECT)
    .eq("user_id", userId)
    .eq("status", "disponivel")
    .not("preco", "is", null);
  if (faixa === "ate_300") {
    q = q.lte("preco", 300_000);
  } else if (faixa === "300_600") {
    q = q.gt("preco", 300_000).lte("preco", 600_000);
  } else {
    q = q.gt("preco", 600_000);
  }
  return q.order("preco", { ascending: true })
    .order("destaque", { ascending: false })
    .order("updated_at", { ascending: false });
}

export function buildShowcaseDeps(ctx: ShowcaseBridgeContext): ShowcaseTurnDeps {
  let stateRef = ctx.agentState;
  return {
    loadTenantFlags: async (): Promise<VehicleShowcaseTenantFlags> => {
      const { data } = await ctx.sb.from("empresa_config")
        .select("segmento,vitrine_veiculos_demo,nome_empresa")
        .eq("user_id", ctx.userId)
        .maybeSingle();
      return {
        segmento: String(data?.segmento || "").trim() || null,
        vitrine_veiculos_demo: data?.vitrine_veiculos_demo === true,
        nome_empresa: String(data?.nome_empresa || "").trim() || null,
      };
    },
    loadMarcas: async () => {
      const { data } = await ctx.sb.from("veiculos_estoque")
        .select("marca")
        .eq("user_id", ctx.userId)
        .eq("status", "disponivel");
      const set = new Set<string>();
      for (const row of data ?? []) {
        const m = String(row.marca || "").trim();
        if (m) set.add(m);
      }
      return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
    loadPrecosDisponiveis: async () => {
      const { data } = await ctx.sb.from("veiculos_estoque")
        .select("preco")
        .eq("user_id", ctx.userId)
        .eq("status", "disponivel");
      return (data ?? [])
        .map((row: { preco?: number | null }) => row.preco)
        .filter((p): p is number => p != null && Number.isFinite(Number(p)));
    },
    loadVeiculosByMarca: async (marca, offset, limit) => {
      const { data } = await ctx.sb.from("veiculos_estoque")
        .select(VEHICLE_SELECT)
        .eq("user_id", ctx.userId)
        .eq("status", "disponivel")
        .eq("marca", marca)
        .order("destaque", { ascending: false })
        .order("updated_at", { ascending: false })
        .order("preco", { ascending: true })
        .range(offset, offset + limit - 1);
      return (data ?? []) as VeiculoVitrineRow[];
    },
    loadVeiculosByFaixa: async (faixa, offset, limit) => {
      const { data } = await faixaQuery(ctx.sb, ctx.userId, faixa)
        .range(offset, offset + limit - 1);
      return (data ?? []) as VeiculoVitrineRow[];
    },
    loadVeiculoById: async (id) => {
      const { data } = await ctx.sb.from("veiculos_estoque")
        .select(VEHICLE_SELECT)
        .eq("user_id", ctx.userId)
        .eq("id", id)
        .eq("status", "disponivel")
        .maybeSingle();
      return (data as VeiculoVitrineRow | null) ?? null;
    },
    sendText: (text) => postSendMessage(ctx, { message: text }),
    sendMenu: (body, sections, button) => postSendMessage(ctx, {
      message: body,
      interactive_list: {
        body,
        button: button || "Ver opções",
        sections,
      },
    }),
    sendButtons: (body, buttons, imageUrl) => postSendMessage(ctx, {
      message: body,
      interactive_buttons: {
        body,
        buttons,
        ...(imageUrl ? { header_image_url: imageUrl } : {}),
      },
    }),
    sendImageHeaderButtons: (body, buttons, imageUrl) => postSendMessage(ctx, {
      message: body,
      interactive_buttons: {
        body,
        buttons,
        header_image_url: imageUrl,
      },
    }),
    sendImage: (imageUrl, caption) => postSendMessage(ctx, {
      message: caption || "",
      image_url: imageUrl,
    }),
    sendCarousel: async (body, cards) => postSendMessage(ctx, {
      message: body,
      interactive_carousel: { body, cards },
      allow_carousel_failure: true,
    }),
    encaminharRecado: ctx.encaminharRecado,
    savePending: async (pending) => {
      const current = await ctx.loadAgentState();
      const vehicle = { ...(current.vehicle as Record<string, unknown> ?? {}), pending_vitrine_estoque: pending };
      stateRef = { ...current, vehicle };
      await ctx.saveAgentStatePatch({ vehicle }, current);
    },
    getPending: () => pendingFromState(stateRef),
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

export async function executeVehicleStockShowcase(input: {
  ctx: ShowcaseBridgeContext;
  userText: string;
  listId?: string;
  inboundPayload?: unknown;
  forceInteractive?: boolean;
  allowEarlyFormCapture?: boolean;
}) {
  const deps = buildShowcaseDeps(input.ctx);
  return runVehicleStockShowcaseTurn({
    userText: input.userText,
    listId: input.listId,
    inboundPayload: input.inboundPayload,
    contactName: input.ctx.contactName,
    fromNumber: input.ctx.to,
    forceInteractive: input.forceInteractive,
    allowEarlyFormCapture: input.allowEarlyFormCapture,
    deps,
  });
}
