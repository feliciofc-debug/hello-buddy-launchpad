import { calcGestaoLucro } from "./gestao-lucro-calc.ts";
import { formatGestaoMoney } from "./gestao-format.ts";
import {
  isGestaoAuthorizedPhone,
  loadGestaoAuthContext,
  maskGestaoPhone,
  type GestaoAuthContext,
} from "./gestao-auth-phone.ts";
import {
  classifyGestaoIntent,
  isGestaoAffirmative,
  isGestaoNegative,
  parseGestaoDisambiguationPick,
  type GestaoIntent,
} from "./gestao-intent-pt.ts";
import {
  formatGestaoVeiculoLabel,
  rankGestaoVeiculoMatches,
  type GestaoVeiculoRow,
} from "./gestao-veiculo-match.ts";
import { loadTenantVehicleStockGate } from "./vehicle-inventory-tenant.ts";
export const GESTAO_PENDING_TTL_MS = 10 * 60 * 1000;
export const GESTAO_DESFAZER_TTL_MS = 24 * 60 * 60 * 1000;

export type PendingGestaoConfirm = {
  phase: "disambiguation" | "confirm" | "desfazer_confirm";
  action: GestaoIntent["kind"];
  draft: Record<string, unknown>;
  expires_at: string;
  options?: Array<{ n: number; veiculo_id: string; label: string }>;
  disambiguation_warned?: boolean;
};

const GESTAO_VEHICLE_SELECT =
  "id,marca,modelo,versao,ano_modelo,cor,placa,status,preco";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GestaoDb = { from: (table: string) => any };

function pendingActive(pending: PendingGestaoConfirm | null | undefined): boolean {
  if (!pending?.expires_at) return false;
  const exp = Date.parse(pending.expires_at);
  return Number.isFinite(exp) && Date.now() < exp;
}

function formatBrl(value: number): string {
  return formatGestaoMoney(value);
}

async function loadVehicles(
  sb: unknown,
  userId: string,
): Promise<GestaoVeiculoRow[]> {
  const client = sb as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => Promise<{ data: GestaoVeiculoRow[] | null }>;
      };
    };
  };
  const { data } = await client.from("veiculos_estoque").select(GESTAO_VEHICLE_SELECT)
    .eq("user_id", userId);
  return data ?? [];
}

async function fetchLucroVeiculo(
  sb: unknown,
  userId: string,
  veiculoId: string,
  veiculo: GestaoVeiculoRow,
): Promise<string> {
  const client = sb as GestaoDb;
  const [{ data: compra }, { data: despesas }, { data: venda }] = await Promise.all([
    client.from("veiculo_compra").select("valor_compra, data_compra")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).maybeSingle(),
    client.from("veiculo_despesas").select("valor, categoria")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).is("deleted_at", null),
    client.from("veiculo_venda").select("valor_venda, data_venda")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).maybeSingle(),
  ]);
  const dList = (despesas ?? []).map((d: Record<string, unknown>) => ({
    valor: Number(d.valor),
    categoria: String(d.categoria ?? ""),
  }));
  const lucro = calcGestaoLucro({
    valorCompra: compra ? Number(compra.valor_compra) : null,
    despesas: dList,
    valorVenda: venda ? Number(venda.valor_venda) : null,
    precoAnunciado: veiculo.preco != null ? Number(veiculo.preco) : null,
    dataCompra: compra ? String(compra.data_compra) : null,
    dataVenda: venda ? String(venda.data_venda) : null,
    statusVeiculo: veiculo.status ?? "disponivel",
  });
  const label = formatGestaoVeiculoLabel(veiculo);
  if (lucro.vendido && lucro.lucroLiquido != null) {
    return `${label}: lucro líquido ${formatBrl(lucro.lucroLiquido)} (margem ${
      lucro.margemPct?.toFixed(1) ?? "—"
    }%).`;
  }
  return `${label}: lucro projetado ${formatGestaoMoney(lucro.lucroProjetado)} (investido ${
    formatBrl(lucro.investido)
  }).`;
}

async function fetchDespesasVeiculo(
  sb: unknown,
  userId: string,
  veiculoId: string,
  veiculo: GestaoVeiculoRow,
): Promise<string> {
  const client = sb as GestaoDb;
  const { data } = await client.from("veiculo_despesas").select("data, categoria, valor, descricao")
    .eq("user_id", userId).eq("veiculo_id", veiculoId).is("deleted_at", null)
    .order("data", { ascending: false });
  const lines = (data ?? []).slice(0, 8).map((d: Record<string, unknown>) =>
    `${d.data}: ${formatBrl(Number(d.valor))} (${d.categoria})`
  );
  const label = formatGestaoVeiculoLabel(veiculo);
  if (!lines.length) return `${label}: nenhuma despesa registrada.`;
  return `${label} — despesas:\n${lines.join("\n")}`;
}

async function fetchLucroMes(sb: unknown, userId: string): Promise<string> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const client = sb as GestaoDb;
  const { data: vendas } = await client.from("veiculo_venda").select("veiculo_id, valor_venda")
    .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);
  let lucro = 0;
  for (const v of vendas ?? []) {
    const vid = String(v.veiculo_id);
    const valorVenda = Number(v.valor_venda);
    const [{ data: compra }, { data: despesas }] = await Promise.all([
      client.from("veiculo_compra").select("valor_compra")
        .eq("user_id", userId).eq("veiculo_id", vid).maybeSingle(),
      client.from("veiculo_despesas").select("valor")
        .eq("user_id", userId).eq("veiculo_id", vid).is("deleted_at", null),
    ]);
    const compraVal = compra ? Number(compra.valor_compra) : 0;
    const desp = (despesas ?? []).reduce(
      (acc: number, d: Record<string, unknown>) => acc + Number(d.valor),
      0,
    );
    lucro += valorVenda - compraVal - desp;
  }
  return `Lucro do mês (vendas registradas): ${formatBrl(lucro)}.`;
}

function buildConfirmMessage(
  action: GestaoIntent["kind"],
  veiculo: GestaoVeiculoRow,
  draft: Record<string, unknown>,
): string {
  const label = formatGestaoVeiculoLabel(veiculo);
  if (action === "despesa") {
    return `Confirmar despesa de ${formatBrl(Number(draft.valor))} (${draft.categoria}) no ${label}?\nResponda SIM ou NÃO.`;
  }
  if (action === "compra") {
    const origem = draft.consignacao ? "consignação" : "compra";
    return `Confirmar ${origem} de ${formatBrl(Number(draft.valor))} no ${label}?\nResponda SIM ou NÃO.`;
  }
  if (action === "venda") {
    return `Confirmar venda de ${formatBrl(Number(draft.valor))} no ${label}?\nResponda SIM ou NÃO.`;
  }
  return `Confirmar?\nResponda SIM ou NÃO.`;
}

async function recordWhatsappLancamento(
  sb: unknown,
  userId: string,
  fromNumber: string,
  tipo: string,
  referenciaId: string | null,
  referenciaTabela: string | null,
) {
  const client = sb as {
    from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<unknown> };
  };
  await client.from("gestao_lancamentos_whatsapp").insert({
    user_id: userId,
    telefone_mascarado: maskGestaoPhone(fromNumber),
    tipo,
    referencia_id: referenciaId,
    referencia_tabela: referenciaTabela,
  });
}

async function persistDraft(
  sb: unknown,
  userId: string,
  fromNumber: string,
  action: GestaoIntent["kind"],
  veiculoId: string,
  draft: Record<string, unknown>,
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const client = sb as GestaoDb;

  if (action === "despesa") {
    const { data, error } = await client.from("veiculo_despesas").insert({
      user_id: userId,
      veiculo_id: veiculoId,
      valor: draft.valor,
      data: today,
      categoria: draft.categoria,
      descricao: draft.descricao ?? null,
      origem_lancamento: "whatsapp_texto",
      lancado_por: maskGestaoPhone(fromNumber),
    }).select("id").single();
    if (error) throw new Error(error.message);
    await recordWhatsappLancamento(
      sb,
      userId,
      fromNumber,
      "despesa",
      data?.id ?? null,
      "veiculo_despesas",
    );
    return "Despesa registrada.";
  }

  if (action === "compra") {
    const { error } = await client.from("veiculo_compra").upsert({
      user_id: userId,
      veiculo_id: veiculoId,
      valor_compra: draft.valor,
      data_compra: today,
      origem: draft.consignacao ? "consignacao" : "compra",
    }, { onConflict: "user_id,veiculo_id" });
    if (error) throw new Error(error.message);
    await recordWhatsappLancamento(sb, userId, fromNumber, "compra", veiculoId, "veiculo_compra");
    return "Compra registrada.";
  }

  if (action === "venda") {
    const { error } = await client.from("veiculo_venda").upsert({
      user_id: userId,
      veiculo_id: veiculoId,
      valor_venda: draft.valor,
      data_venda: today,
      marcou_vendido: false,
    }, { onConflict: "user_id,veiculo_id" });
    if (error) throw new Error(error.message);
    await recordWhatsappLancamento(sb, userId, fromNumber, "venda", veiculoId, "veiculo_venda");
    return "Venda registrada.";
  }

  throw new Error("acao_invalida");
}

async function prepareDesfazer(
  sb: unknown,
  userId: string,
  fromNumber: string,
): Promise<{ reply: string; pending: PendingGestaoConfirm } | { reply: string }> {
  const mask = maskGestaoPhone(fromNumber);
  const cutoff = new Date(Date.now() - GESTAO_DESFAZER_TTL_MS).toISOString();
  const client = sb as GestaoDb;
  const { data: last } = await client.from("gestao_lancamentos_whatsapp")
    .select("id, tipo, referencia_id, referencia_tabela, created_at")
    .eq("user_id", userId).eq("telefone_mascarado", mask).gte("created_at", cutoff)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!last) {
    return { reply: "Não encontrei lançamento recente seu para desfazer (24h)." };
  }
  const pending: PendingGestaoConfirm = {
    phase: "desfazer_confirm",
    action: "desfazer",
    draft: {
      lancamento_id: last.id,
      tipo: last.tipo,
      referencia_id: last.referencia_id,
      referencia_tabela: last.referencia_tabela,
    },
    expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
  };
  return {
    reply:
      `Desfazer último lançamento (${last.tipo})?\nResponda SIM ou NÃO.`,
    pending,
  };
}

async function executeDesfazer(sb: unknown, userId: string, draft: Record<string, unknown>): Promise<string> {
  const tabela = String(draft.referencia_tabela ?? "");
  const refId = draft.referencia_id;
  const client = sb as GestaoDb;
  if (tabela === "veiculo_despesas" && refId) {
    const { error } = await client.from("veiculo_despesas").update({
      deleted_at: new Date().toISOString(),
      deleted_by: "whatsapp_desfazer",
    }).eq("id", String(refId)).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return "Último lançamento desfeito.";
  }
  if (tabela === "veiculo_compra" && refId) {
    const { error } = await client.from("veiculo_compra").delete().eq("user_id", userId).eq(
      "veiculo_id",
      String(refId),
    );
    if (error) throw new Error(error.message);
    return "Compra removida.";
  }
  if (tabela === "veiculo_venda" && refId) {
    const { error } = await client.from("veiculo_venda").delete().eq("user_id", userId).eq(
      "veiculo_id",
      String(refId),
    );
    if (error) throw new Error(error.message);
    return "Venda removida.";
  }
  return "Não foi possível desfazer esse lançamento.";
}

export async function tryProcessGestaoLucroInbound(input: {
  sb: unknown;
  userId: string;
  fromNumber: string;
  userText: string;
  hasInboundMedia: boolean;
  auth: GestaoAuthContext;
  agentState: Record<string, unknown>;
  saveAgentStatePatch: (
    patch: Record<string, unknown>,
    current: Record<string, unknown>,
  ) => Promise<boolean>;
}): Promise<{ handled: boolean; reply?: string; clearPending?: boolean }> {
  if (input.hasInboundMedia) return { handled: false };
  if (!isGestaoAuthorizedPhone(input.fromNumber, input.auth)) return { handled: false };

  const gate = await loadTenantVehicleStockGate(
    input.sb as Parameters<typeof loadTenantVehicleStockGate>[0],
    input.userId,
  );
  if (!gate.usesVehicleStock) return { handled: false };

  const text = (input.userText || "").trim();
  if (!text) return { handled: false };

  const pending = input.agentState.pending_gestao_confirm as PendingGestaoConfirm | undefined;

  if (pending && !pendingActive(pending)) {
    await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
    input.agentState.pending_gestao_confirm = null;
  }

  const activePending = pendingActive(pending) ? pending : null;

  if (activePending) {
    if (isGestaoNegative(text)) {
      await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
      return { handled: true, reply: "Ok, cancelado." };
    }

    if (activePending.phase === "disambiguation") {
      const pick = parseGestaoDisambiguationPick(text);
      if (pick != null) {
        const opt = activePending.options?.find((o) => o.n === pick);
        if (!opt) {
          if (!activePending.disambiguation_warned) {
            const retried: PendingGestaoConfirm = {
              ...activePending,
              disambiguation_warned: true,
              expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
            };
            await input.saveAgentStatePatch({ pending_gestao_confirm: retried }, input.agentState);
            const lines = activePending.options?.map((o) => `${o.n}. ${o.label}`).join("\n") ?? "";
            return {
              handled: true,
              reply: `Número inválido. Escolha:\n${lines}\nResponda com o número.`,
            };
          }
          await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
          return { handled: false, clearPending: true };
        }
        const vehicles = await loadVehicles(input.sb, input.userId);
        const veiculo = vehicles.find((v) => v.id === opt.veiculo_id);
        if (!veiculo) {
          await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
          return { handled: true, reply: "Veículo não encontrado." };
        }
        const confirmPending: PendingGestaoConfirm = {
          phase: "confirm",
          action: activePending.action,
          draft: { ...activePending.draft, veiculo_id: veiculo.id },
          expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
        };
        await input.saveAgentStatePatch({ pending_gestao_confirm: confirmPending }, input.agentState);
        return {
          handled: true,
          reply: buildConfirmMessage(activePending.action, veiculo, confirmPending.draft),
        };
      }
      await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
      return { handled: false, clearPending: true };
    }

    if (isGestaoAffirmative(text)) {
      if (activePending.phase === "desfazer_confirm") {
        const msg = await executeDesfazer(input.sb, input.userId, activePending.draft);
        await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
        return { handled: true, reply: msg };
      }
      if (activePending.phase === "confirm") {
        const veiculoId = String(activePending.draft.veiculo_id ?? "");
        const msg = await persistDraft(
          input.sb,
          input.userId,
          input.fromNumber,
          activePending.action,
          veiculoId,
          activePending.draft,
        );
        await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
        return { handled: true, reply: msg };
      }
    }

    await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
    return { handled: false, clearPending: true };
  }

  const intent = classifyGestaoIntent(text);
  if (intent.kind === "none") return { handled: false };

  if (intent.kind === "lucro_mes") {
    const reply = await fetchLucroMes(input.sb, input.userId);
    return { handled: true, reply };
  }

  const vehicles = await loadVehicles(input.sb, input.userId);
  const matches = rankGestaoVeiculoMatches(intent.vehicleHint, vehicles);

  if (intent.kind === "lucro_veiculo") {
    if (!matches[0]) return { handled: true, reply: "Não achei esse veículo no estoque." };
    const reply = await fetchLucroVeiculo(input.sb, input.userId, matches[0].id, matches[0]);
    return { handled: true, reply };
  }

  if (intent.kind === "despesas_veiculo") {
    if (!matches[0]) return { handled: true, reply: "Não achei esse veículo no estoque." };
    const reply = await fetchDespesasVeiculo(input.sb, input.userId, matches[0].id, matches[0]);
    return { handled: true, reply };
  }

  if (intent.kind === "desfazer") {
    const prep = await prepareDesfazer(input.sb, input.userId, input.fromNumber);
    if ("pending" in prep) {
      await input.saveAgentStatePatch({ pending_gestao_confirm: prep.pending }, input.agentState);
    }
    return { handled: true, reply: prep.reply };
  }

  if (!matches.length) {
    return { handled: true, reply: "Qual veículo? Informe modelo ou placa." };
  }

  if (matches.length > 1) {
    const options = matches.slice(0, 5).map((v, i) => ({
      n: i + 1,
      veiculo_id: v.id,
      label: formatGestaoVeiculoLabel(v),
    }));
    const pendingDis: PendingGestaoConfirm = {
      phase: "disambiguation",
      action: intent.kind,
      draft: {
        valor: intent.valor,
        categoria: intent.categoria,
        consignacao: intent.consignacao,
      },
      expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
      options,
    };
    await input.saveAgentStatePatch({ pending_gestao_confirm: pendingDis }, input.agentState);
    const lines = options.map((o) => `${o.n}. ${o.label}`).join("\n");
    return { handled: true, reply: `Qual veículo?\n${lines}\nResponda com o número.` };
  }

  const veiculo = matches[0];
  const draft = {
    valor: intent.valor,
    categoria: intent.categoria,
    consignacao: intent.consignacao,
    veiculo_id: veiculo.id,
  };
  const confirmPending: PendingGestaoConfirm = {
    phase: "confirm",
    action: intent.kind,
    draft,
    expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
  };
  await input.saveAgentStatePatch({ pending_gestao_confirm: confirmPending }, input.agentState);
  return {
    handled: true,
    reply: buildConfirmMessage(intent.kind, veiculo, draft),
  };
}

export { loadGestaoAuthContext };
