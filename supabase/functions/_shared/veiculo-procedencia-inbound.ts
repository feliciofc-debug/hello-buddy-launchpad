import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  isGestaoAuthorizedPhone,
  maskGestaoPhone,
  type GestaoAuthContext,
} from "./gestao-auth-phone.ts";
import { isGestaoAffirmative, isGestaoNegative } from "./gestao-intent-pt.ts";
import { loadTenantVehicleStockGate } from "./vehicle-inventory-tenant.ts";
import {
  CONSULTAR_PLACA_TESTE,
  consultarPlacaSaldo,
  PROCEDENCIA_CUSTO_ESTIMADO_BRL,
} from "./consultar-placa-client.ts";
import { formatGestaoMoney } from "./gestao-format.ts";
import {
  credsFromConfig,
  formatProcedenciaWhatsApp,
  loadProcedenciaConfig,
  normalizePlacaInput,
  runProcedenciaConsulta,
  sendProcedenciaWhatsAppReply,
} from "./veiculo-procedencia-core.ts";
const PENDING_TTL_MS = 15 * 60 * 1000;

export type PendingProcedenciaConfirm = {
  placa: string;
  veiculo_id?: string | null;
  expires_at: string;
  is_test?: boolean;
};

const TRIGGER_RES = [
  /\bprocedencia\b/i,
  /\bprocedência\b/i,
  /\bconsulta\s+placa\b/i,
  /\bpuxa\s+a\s+placa\b/i,
];

function normalize(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function parsePlacaFromProcedenciaText(text: string): string | null {
  const raw = String(text || "").toUpperCase();
  const merco = raw.match(/\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\b/);
  if (merco) return merco[1];
  const old = raw.match(/\b([A-Z]{3}[0-9]{4})\b/);
  if (old) return old[1];
  return null;
}

export function isProcedenciaWhatsAppRequest(text: string): boolean {
  const t = normalize(text);
  if (!parsePlacaFromProcedenciaText(text)) return false;
  return TRIGGER_RES.some((re) => re.test(t));
}

function pendingActive(p: PendingProcedenciaConfirm | undefined): boolean {
  if (!p?.expires_at) return false;
  return Date.parse(p.expires_at) > Date.now();
}

export function scheduleProcedenciaBackgroundJob(
  sb: SupabaseClient,
  consultaId: string,
  userId: string,
  fromNumber: string,
  placa: string,
  isTest: boolean,
): void {
  const work = (async () => {
    try {
      const { resumo, erroTipo } = await runProcedenciaConsulta(sb, userId, placa, {
        canal: "whatsapp",
        solicitadoPor: maskGestaoPhone(fromNumber),
        consultaId,
      });
      if (erroTipo === "servico_indisponivel") {
        await sendProcedenciaWhatsAppReply(
          sb,
          userId,
          fromNumber,
          "Serviço de procedência indisponível no momento. Tente mais tarde.",
        );
        return;
      }
      const msg = formatProcedenciaWhatsApp(placa, resumo, { teste: isTest });
      await sendProcedenciaWhatsAppReply(sb, userId, fromNumber, msg);
    } catch (e) {
      const err = (e as Error).message ?? "erro";
      await sendProcedenciaWhatsAppReply(
        sb,
        userId,
        fromNumber,
        `Não foi possível concluir a procedência: ${err}`,
      );
    }
  })();
  const er = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (er?.waitUntil) {
    er.waitUntil(work);
  } else {
    void work;
  }
}

export async function tryProcessVeiculoProcedenciaInbound(input: {
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
}): Promise<{ handled: boolean; reply?: string }> {
  if (input.hasInboundMedia) return { handled: false };
  if (!isGestaoAuthorizedPhone(input.fromNumber, input.auth)) return { handled: false };

  const gate = await loadTenantVehicleStockGate(
    input.sb as Parameters<typeof loadTenantVehicleStockGate>[0],
    input.userId,
  );
  if (!gate.usesVehicleStock) return { handled: false };

  const text = (input.userText || "").trim();
  if (!text) return { handled: false };

  const sb = input.sb as SupabaseClient;
  const pending = input.agentState.pending_procedencia_confirm as
    | PendingProcedenciaConfirm
    | undefined;

  if (pending && !pendingActive(pending)) {
    await input.saveAgentStatePatch({ pending_procedencia_confirm: null }, input.agentState);
  }

  const active = pendingActive(pending) ? pending : null;

  if (active) {
    if (isGestaoNegative(text)) {
      await input.saveAgentStatePatch({ pending_procedencia_confirm: null }, input.agentState);
      return { handled: true, reply: "Ok, consulta de procedência cancelada." };
    }
    if (isGestaoAffirmative(text)) {
      await input.saveAgentStatePatch({ pending_procedencia_confirm: null }, input.agentState);
      const placa = normalizePlacaInput(active.placa);
      const { data: ins, error } = await sb.from("veiculo_procedencia_consulta").insert({
        user_id: input.userId,
        placa,
        veiculo_id: active.veiculo_id ?? null,
        solicitado_por: maskGestaoPhone(input.fromNumber),
        canal: "whatsapp",
        status: "processando",
        custo_estimado: active.is_test ? 0 : PROCEDENCIA_CUSTO_ESTIMADO_BRL,
      }).select("id").single();
      if (error || !ins?.id) {
        return { handled: true, reply: "Não foi possível iniciar a consulta." };
      }
      scheduleProcedenciaBackgroundJob(
        sb,
        String(ins.id),
        input.userId,
        input.fromNumber,
        placa,
        !!active.is_test,
      );
      return { handled: true, reply: "Consultando… isso pode levar alguns minutos." };
    }
    return {
      handled: true,
      reply: "Responda *sim* para confirmar ou *não* para cancelar.",
    };
  }

  if (!isProcedenciaWhatsAppRequest(text)) return { handled: false };

  const placa = parsePlacaFromProcedenciaText(text);
  if (!placa) return { handled: false };

  const cfg = await loadProcedenciaConfig(sb, input.userId);
  if (!cfg?.ativo) {
    return {
      handled: true,
      reply:
        "A loja ainda não ativou a consulta de procedência. Ative em Configurações → Procedência veicular.",
    };
  }

  const isTest = normalizePlacaInput(placa) === CONSULTAR_PLACA_TESTE;

  if (isTest) {
    const { data: ins, error } = await sb.from("veiculo_procedencia_consulta").insert({
      user_id: input.userId,
      placa: CONSULTAR_PLACA_TESTE,
      solicitado_por: maskGestaoPhone(input.fromNumber),
      canal: "whatsapp",
      status: "processando",
      custo_estimado: 0,
    }).select("id").single();
    if (error || !ins?.id) {
      return { handled: true, reply: "Não foi possível iniciar a consulta de teste." };
    }
    scheduleProcedenciaBackgroundJob(
      sb,
      String(ins.id),
      input.userId,
      input.fromNumber,
      CONSULTAR_PLACA_TESTE,
      true,
    );
    return { handled: true, reply: "Consultando placa de teste…" };
  }

  const creds = await credsFromConfig(cfg);
  const saldo = await consultarPlacaSaldo(creds);
  const saldoTxt = saldo.saldo != null ? formatGestaoMoney(saldo.saldo) : "—";
  const custoTxt = formatGestaoMoney(PROCEDENCIA_CUSTO_ESTIMADO_BRL);

  const confirm: PendingProcedenciaConfirm = {
    placa: normalizePlacaInput(placa),
    expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
  };
  await input.saveAgentStatePatch({ pending_procedencia_confirm: confirm }, input.agentState);

  return {
    handled: true,
    reply:
      `🔎 Procedência da placa ${confirm.placa} — usa ~${custoTxt} dos créditos da loja (saldo atual ${saldoTxt}). Confirma? (sim/não)`,
  };
}
