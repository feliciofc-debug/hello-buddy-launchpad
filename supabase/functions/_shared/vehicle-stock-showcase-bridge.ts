import {
  applyTrocaPhotoAndReply,
  applyTrocaPhotoReprompt,
  runVehicleStockShowcaseTurn,
  ShowcaseSendResult,
  ShowcaseTurnDeps,
  VEHICLE_SELECT,
} from "./vehicle-stock-showcase-turn.ts";
import {
  appendTrocaInternalNotes,
  buildTrocaStoragePath,
  currentTrocaFotoSlot,
  evaluateTrocaPhotoVision,
  shouldCaptureVitrineTrocaPhoto,
} from "./vehicle-stock-troca.ts";
import { analyzeTrocaPhotoVision } from "./vehicle-stock-troca-vision.ts";
import { fetchViaCep } from "./viacep-client.ts";
import type { FinanciamentoFichaRow } from "./vehicle-stock-financiamento.ts";
import {
  FaixaPrecoId,
  isTransientVitrineSendFailure,
  PendingVitrineEstoque,
  VehicleShowcaseTenantFlags,
  VeiculoVitrineRow,
  VITRINE_SEND_RETRY_DELAYS_MS,
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

async function postSendMessageOnce(
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

async function postSendMessage(
  ctx: ShowcaseBridgeContext,
  body: Record<string, unknown>,
): Promise<ShowcaseSendResult> {
  let last = await postSendMessageOnce(ctx, body);
  for (const delayMs of VITRINE_SEND_RETRY_DELAYS_MS) {
    if (last.ok || !isTransientVitrineSendFailure(last)) break;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    last = await postSendMessageOnce(ctx, body);
  }
  return last;
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
  return q.order("destaque", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("preco", { ascending: true });
}

function buildShowcaseDeps(ctx: ShowcaseBridgeContext): ShowcaseTurnDeps {
  let stateRef = ctx.agentState;
  return {
    loadTenantFlags: async () => {
      const { data } = await ctx.sb.from("empresa_config")
        .select("segmento, vitrine_veiculos_demo, nome_empresa")
        .eq("user_id", ctx.userId)
        .maybeSingle();
      return {
        segmento: data?.segmento ?? null,
        vitrine_veiculos_demo: data?.vitrine_veiculos_demo === true,
        nome_empresa: data?.nome_empresa ?? null,
      } satisfies VehicleShowcaseTenantFlags;
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
    userId: ctx.userId,
    fetchViaCep: (cep) => fetchViaCep(cep),
    saveFinanciamentoFicha: async (row: FinanciamentoFichaRow) => {
      const { data, error } = await ctx.sb.from("financiamento_fichas")
        .insert({
          user_id: row.user_id,
          veiculo_id: row.veiculo_id,
          whatsapp_from: row.whatsapp_from,
          whatsapp_contact_name: row.whatsapp_contact_name,
          cliente_nome_vitrine: row.cliente_nome_vitrine,
          lgpd_aceite_em: row.lgpd_aceite_em,
          tipo_pessoa: row.tipo_pessoa,
          nome_completo: row.nome_completo,
          cpf_cnpj: row.cpf_cnpj,
          data_nascimento: row.data_nascimento,
          email: row.email,
          cep: row.cep,
          logradouro: row.logradouro,
          numero: row.numero,
          complemento: row.complemento,
          bairro: row.bairro,
          cidade: row.cidade,
          uf: row.uf,
          renda_mensal: row.renda_mensal,
          telefone_referencia: row.telefone_referencia,
          entrada: row.entrada,
          prazo_meses: row.prazo_meses,
        })
        .select("id")
        .single();
      if (error || !data?.id) {
        throw new Error(error?.message || "financiamento_ficha_insert_failed");
      }
      return { id: String(data.id) };
    },
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function processVitrineTrocaInboundPhoto(input: {
  ctx: ShowcaseBridgeContext;
  userText: string;
  bytes: Uint8Array;
  mime: string;
  visionApiKey?: string | null;
}): Promise<{ handled: boolean; preview?: string }> {
  const state = await input.ctx.loadAgentState();
  const pending = getPendingVitrineEstoque(state);
  if (!shouldCaptureVitrineTrocaPhoto(pending) || !pending?.form) {
    return { handled: false };
  }
  const slot = currentTrocaFotoSlot(pending.form);
  if (!slot) return { handled: false };

  const sessionId = pending.form.troca_sessao_id ?? crypto.randomUUID();
  if (!pending.form.troca_sessao_id) {
    const now = new Date().toISOString();
    await input.ctx.saveAgentStatePatch({
      vehicle: {
        ...(state.vehicle as Record<string, unknown> ?? {}),
        pending_vitrine_estoque: {
          ...pending,
          form: { ...pending.form, troca_sessao_id: sessionId, updated_at: now },
          updated_at: now,
        },
      },
    }, state);
  }

  const path = buildTrocaStoragePath(input.ctx.userId, sessionId, slot.id);
  const contentType = input.mime.startsWith("image/") ? input.mime : "image/jpeg";
  const { error: upErr } = await input.ctx.sb.storage
    .from("produtos")
    .upload(path, input.bytes, { contentType, upsert: true });
  if (upErr) {
    console.error("[vehicle-vitrine][troca-upload]", upErr.message);
    return { handled: false };
  }
  const { data: pub } = input.ctx.sb.storage.from("produtos").getPublicUrl(path);
  const url = pub?.publicUrl;
  if (!url) return { handled: false };

  const deps = buildShowcaseDeps(input.ctx);
  const turnInput = {
    userText: input.userText,
    fromNumber: input.ctx.to,
    contactName: input.ctx.contactName,
    deps,
  };

  const now = new Date().toISOString();
  let analysis = {
    ok: false,
    view: null,
    nitida: null,
    km_lido: null,
    luzes_alerta: null,
    avarias: null,
    unavailable: true,
  } as import("./vehicle-stock-troca-vision.ts").TrocaVisionAnalysis;

  if (input.visionApiKey) {
    analysis = await analyzeTrocaPhotoVision({
      apiKey: input.visionApiKey,
      mime: contentType,
      base64: bytesToBase64(input.bytes),
      slotLabel: slot.label,
    });
  }

  const decision = evaluateTrocaPhotoVision({
    form: pending.form,
    slotId: slot.id,
    analysis,
    now,
  });

  if (decision.action === "reprompt") {
    const result = await applyTrocaPhotoReprompt(
      turnInput,
      decision.form,
      decision.clientMessage,
    );
    return { handled: result.handled, preview: result.replyPreview };
  }

  const formReady = appendTrocaInternalNotes(
    decision.form,
    decision.internalNotes,
    now,
  );
  await deps.savePending({ ...pending, form: formReady, updated_at: now });

  const result = await applyTrocaPhotoAndReply(turnInput, {
    url,
    vision: decision.visionMeta,
    internalNotes: [],
  });

  return { handled: result.handled, preview: result.replyPreview };
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
