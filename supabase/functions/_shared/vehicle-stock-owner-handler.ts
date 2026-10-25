import { loadTenantVehicleStockGate } from "./vehicle-inventory-tenant.ts";
import { loadGestaoConsultaSnapshot } from "./gestao-consulta-snapshot.ts";
import { formatYmdSaoPaulo } from "./gestao-date-br.ts";
import {
  classifyOwnerStockIntent,
  formatOwnerStockSearchReply,
  formatOwnerStockSummary,
  formatOwnerVendidosCount,
  formatOwnerVendidosMesFromSnapshot,
  ownerStockSegmentFilter,
  rankOwnerStockMatches,
  shouldDeferOwnerStockShortcut,
} from "./vehicle-stock-owner-inbound.ts";
import {
  executeVehicleStockShowcase,
  getPendingVitrineEstoque,
  type ShowcaseBridgeContext,
} from "./vehicle-stock-showcase-bridge.ts";
import {
  extractVitrineInteractiveId,
  pendingIsActive,
  type VeiculoVitrineRow,
} from "./vehicle-stock-whatsapp.ts";
import { isVeiculoEstoqueAtivoInterno } from "./veiculo-estoque-status.ts";

export const OWNER_STOCK_SELECT =
  "id,segmento,marca,modelo,versao,ano_fabricacao,ano_modelo,km,preco,cor,cambio,status,descricao,created_at";

export async function toolConsultarEstoqueVeiculos(
  query: string,
  sb: { from: (table: string) => unknown },
  userId: string,
): Promise<string> {
  const q = (query || "").trim();
  try {
    const client = sb as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => Promise<{ data: VeiculoVitrineRow[] | null }>;
        };
      };
    };
    const { data: rows } = await client.from("veiculos_estoque").select(
      OWNER_STOCK_SELECT,
    ).eq("user_id", userId);
    const all = rows ?? [];
    const ativos = all.filter((v) => isVeiculoEstoqueAtivoInterno(v.status));
    const disponiveis = all.filter((v) => v.status === "disponivel");
    const vendidos = all.filter((v) => v.status === "vendido");
    const motosAtivas = ativos.filter((v) => v.segmento === "moto");

    if (!q) {
      return JSON.stringify({
        escopo: "veiculos_estoque",
        ativos_internos: ativos.length,
        disponiveis: disponiveis.length,
        motos_ativas: motosAtivas.length,
        vendidos: vendidos.length,
        resumo_texto: formatOwnerStockSummary(ativos),
      });
    }

    const reply = formatOwnerStockSearchReply(q, all);
    return JSON.stringify({
      escopo: "veiculos_estoque",
      busca: q,
      resumo_texto: reply,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

export async function tryProcessOwnerVehicleStockInbound(input: {
  sb: unknown;
  userId: string;
  userText: string;
  hasInboundMedia: boolean;
  row: {
    from_number: string;
    payload?: unknown;
  };
  contactName: string | null;
  agentState: Record<string, unknown>;
  supabaseUrl: string;
  serviceKey: string;
  loadAgentState: () => Promise<Record<string, unknown>>;
  saveAgentStatePatch: (
    patch: Record<string, unknown>,
    current: Record<string, unknown>,
  ) => Promise<boolean>;
  encaminharRecado: (recado: string) => Promise<{ ok: boolean; protocolo?: string }>;
  gestaoAuthorized?: boolean;
}): Promise<{ handled: boolean; reply?: string; preview?: string }> {
  const sb = input.sb as Parameters<typeof loadTenantVehicleStockGate>[0];
  const gate = await loadTenantVehicleStockGate(sb, input.userId);
  if (!gate.usesVehicleStock) return { handled: false };

  if (
    shouldDeferOwnerStockShortcut({
      userText: input.userText,
      hasInboundMedia: input.hasInboundMedia,
      agentState: input.agentState,
      gestaoAuthorized: input.gestaoAuthorized,
    })
  ) {
    return { handled: false };
  }

  const flags = {
    segmento: gate.segmento,
    vitrine_veiculos_demo: gate.vitrine_veiculos_demo,
  };
  const listId = String(
    (input.row.payload as { interactive?: { list_reply?: { id?: string } } })
      ?.interactive?.list_reply?.id ?? "",
  );
  const vitrineId = extractVitrineInteractiveId({
    userText: input.userText,
    listId,
    inboundPayload: input.row.payload,
  });
  const pendingVitrine = getPendingVitrineEstoque(input.agentState);
  const intent = classifyOwnerStockIntent(input.userText, flags);

  const showcaseActive = vitrineId ||
    intent === "vitrine" ||
    (pendingVitrine && pendingIsActive(pendingVitrine));

  if (showcaseActive) {
    const ctx: ShowcaseBridgeContext = {
      sb: input.sb,
      userId: input.userId,
      to: input.row.from_number,
      contactName: input.contactName,
      supabaseUrl: input.supabaseUrl,
      serviceKey: input.serviceKey,
      agentState: input.agentState,
      loadAgentState: input.loadAgentState,
      saveAgentStatePatch: input.saveAgentStatePatch,
      encaminharRecado: input.encaminharRecado,
    };
    const result = await executeVehicleStockShowcase({
      ctx,
      userText: input.userText,
      listId,
      inboundPayload: input.row.payload,
      forceInteractive: !!vitrineId,
      audience: "dono",
    });
    return { handled: result.handled, preview: result.replyPreview };
  }

  if (intent === "none") return { handled: false };

  const client = input.sb as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => Promise<{ data: VeiculoVitrineRow[] | null; error?: { message: string } | null }>;
      };
    };
  };
  const { data: rows, error } = await client.from("veiculos_estoque").select(
    OWNER_STOCK_SELECT,
  ).eq("user_id", input.userId);
  if (error) throw new Error(error.message);
  const all = rows ?? [];

  let reply = "";
  if (intent === "resumo" || intent === "resumo_moto") {
    const seg = intent === "resumo_moto"
      ? "moto"
      : ownerStockSegmentFilter(input.userText);
    let ativos = all.filter((v) => isVeiculoEstoqueAtivoInterno(v.status));
    if (seg === "moto") {
      ativos = ativos.filter((v) => v.segmento === "moto");
    } else if (seg === "carro") {
      ativos = ativos.filter((v) => v.segmento !== "moto");
    }
    reply = formatOwnerStockSummary(
      ativos,
      seg === "moto" ? "Motos" : "Estoque",
    );
  } else if (intent === "vendidos") {
    if (input.gestaoAuthorized) {
      const now = new Date();
      const snap = await loadGestaoConsultaSnapshot(
        input.sb as Parameters<typeof loadGestaoConsultaSnapshot>[0],
        input.userId,
        "mes",
        now,
      );
      const hoje = formatYmdSaoPaulo(now);
      const periodo = snap.periodo as { competencia?: string; fim?: string } | undefined;
      const fim = String(periodo?.fim ?? "").slice(0, 10);
      const ateDia = periodo?.competencia === hoje.slice(0, 7)
        ? `${hoje.slice(8, 10)}/${hoje.slice(5, 7)}`
        : fim.length >= 10
        ? `${fim.slice(8, 10)}/${fim.slice(5, 7)}`
        : `${hoje.slice(8, 10)}/${hoje.slice(5, 7)}`;
      reply = formatOwnerVendidosMesFromSnapshot(snap, ateDia);
    } else {
      reply = formatOwnerVendidosCount(
        all.filter((v) => v.status === "vendido").length,
      );
    }
  } else if (intent === "busca") {
    const disponiveis = all.filter((v) => isVeiculoEstoqueAtivoInterno(v.status));
    const matches = rankOwnerStockMatches(input.userText, disponiveis);
    if (!matches.length) return { handled: false };
    reply = formatOwnerStockSearchReply(input.userText, all);
  } else {
    return { handled: false };
  }

  return { handled: true, reply, preview: reply.slice(0, 120) };
}
