import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  type GestaoAuthContext,
  isGestaoAuthorizedPhone,
} from "./gestao-auth-phone.ts";
import { isGestaoAffirmative, isGestaoNegative } from "./gestao-intent-pt.ts";
import { loadTenantVehicleStockGate } from "./vehicle-inventory-tenant.ts";
import {
  MolicarDailyLimitError,
  runMolicarConsulta,
} from "./molicar-service.ts";
import { formatGestaoMoney } from "./gestao-format.ts";
import { runMolicarProcedenciaQuery } from "./molicar-procedencia-service.ts";
import { maybeNotifyMolicarProcedenciaOwner } from "./molicar-procedencia-notify.ts";
import { normalizeBrazilianPlate } from "./vehicle-plate.ts";
const PENDING_TTL_MS = 15 * 60 * 1000;
const MOLICAR_WA_PREFIX = "molicar_wa:";
const MOLICAR_PANEL_PATH = "Gestão › Integrações › Molicar";

export type VeiculoProcedenciaInteractiveButtons = {
  body: string;
  buttons: { id: string; title: string }[];
};

export type PendingProcedenciaConfirm = {
  placa: string;
  veiculo_id?: string | null;
  expires_at: string;
};

const TRIGGER_RES = [
  /\bprocedencia\b/i,
  /\bprocedência\b/i,
];

function normalize(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function parsePlacaFromProcedenciaText(text: string): string | null {
  const match = String(text || "").toUpperCase().match(
    /\b([A-Z]{3}[-\s]?[0-9][A-Z0-9]?[-\s]?[0-9]{2})\b/,
  );
  return normalizeBrazilianPlate(match?.[1]);
}

export function isProcedenciaWhatsAppRequest(text: string): boolean {
  const t = normalize(text);
  if (!parsePlacaFromProcedenciaText(text)) return false;
  return TRIGGER_RES.some((re) => re.test(t));
}

function parseMolicarInteractiveId(text: string): string | null {
  const marker = String(text || "").match(
    /<<INTERACTIVE_ID:molicar_wa:([^>]+)>>/i,
  )?.[1];
  if (marker) return marker.trim();
  const raw = String(text || "").match(/^molicar_wa:(.+)$/i)?.[1];
  return raw?.trim() || null;
}

export function parseMolicarPlateLookupText(text: string): string | null {
  const clean = String(text || "").trim();
  const direct = normalizeBrazilianPlate(clean);
  if (direct) return direct;
  const match = clean.match(
    /^(?:placa|consult(?:a|ar)(?:\s+a)?\s+placa)\s*[:#-]?\s*([a-z]{3}[-\s]?[0-9][a-z0-9]?[-\s]?[0-9]{2})[.!?]*$/i,
  );
  return normalizeBrazilianPlate(match?.[1]);
}

function pendingActive(p: PendingProcedenciaConfirm | undefined): boolean {
  if (!p?.expires_at) return false;
  return Date.parse(p.expires_at) > Date.now();
}

function panelUrl(path: string): string | null {
  const root =
    (Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("SITE_URL") || "")
      .replace(/\/$/, "");
  return root ? `${root}${path}` : null;
}

function panelReply(label: string, path: string): string {
  const url = panelUrl(path);
  return `${label}\n${url ? `${url}\n` : ""}Caminho: ${
    path.startsWith("/gestao/trocas")
      ? "Gestão › Vistoria e Troca"
      : "Gestão › Estoque"
  }`;
}

function value(
  source: Record<string, unknown>,
  key: string,
): string | number | null {
  const found = source[key];
  return typeof found === "string" || typeof found === "number" ? found : null;
}

export function formatMolicarPlateResult(
  result: Record<string, unknown>,
): string {
  const dados = (result.dados ?? {}) as Record<string, unknown>;
  const precos = (result.precos ?? {}) as Record<string, unknown>;
  const read = (candidate: unknown) =>
    candidate == null || String(candidate).trim() === ""
      ? "não informado"
      : String(candidate);
  const price = (candidate: unknown) =>
    typeof candidate === "number" && candidate > 0
      ? formatGestaoMoney(candidate)
      : "não disponível no plano";
  return [
    "🚘 Consulta Molicar",
    `Marca/modelo/versão: ${
      [value(dados, "marca"), value(dados, "modelo"), value(dados, "versao")]
        .filter(Boolean).join(" ") || "não informado"
    }`,
    `Ano: ${
      read(value(dados, "ano_modelo") ?? value(dados, "ano_fabricacao"))
    }`,
    `Combustível: ${read(value(dados, "combustivel"))}`,
    `Molicar Price: ${price(precos.referencia)}`,
    `B2B: ${price(precos.b2b)}`,
    `C2B: ${price(precos.c2b)}`,
  ].join("\n");
}

function molicarResultButtons(
  plate: string,
): VeiculoProcedenciaInteractiveButtons {
  return {
    body: "O que você quer fazer?",
    buttons: [
      { id: `${MOLICAR_WA_PREFIX}procedencia:${plate}`, title: "Procedência" },
      { id: `${MOLICAR_WA_PREFIX}troca:${plate}`, title: "Usar na troca" },
      {
        id: `${MOLICAR_WA_PREFIX}cadastrar:${plate}`,
        title: "Cadastrar estoque",
      },
    ],
  };
}

function procedenciaConfirmation(
  plate: string,
): {
  reply: string;
  buttons: VeiculoProcedenciaInteractiveButtons;
  pending: PendingProcedenciaConfirm;
} {
  const reply =
    "🔎 Procedência Molicar — custo: 3 consultas da cota da loja (Débitos, Gravame e Renajud; a Molicar não publica valor em R$). Confirma?";
  return {
    reply,
    buttons: {
      body: reply,
      buttons: [
        {
          id: `${MOLICAR_WA_PREFIX}procedencia_confirmar`,
          title: "Confirmar",
        },
        {
          id: `${MOLICAR_WA_PREFIX}procedencia_cancelar`,
          title: "Cancelar",
        },
      ],
    },
    pending: {
      placa: plate,
      expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
    },
  };
}

function notConfiguredReply(): string {
  return `Sua loja ainda não tem a Molicar conectada. Caminho: ${MOLICAR_PANEL_PATH}.`;
}

export async function tryProcessVeiculoProcedenciaInbound(input: {
  sb: unknown;
  userId: string;
  fromNumber: string;
  userText: string;
  interactiveId?: string | null;
  hasInboundMedia: boolean;
  auth: GestaoAuthContext;
  agentState: Record<string, unknown>;
  saveAgentStatePatch: (
    patch: Record<string, unknown>,
    current: Record<string, unknown>,
  ) => Promise<boolean>;
  dependencies?: {
    runConsulta?: typeof runMolicarConsulta;
    runProcedencia?: typeof runMolicarProcedenciaQuery;
    notifyProcedencia?: typeof maybeNotifyMolicarProcedenciaOwner;
  };
}): Promise<{
  handled: boolean;
  reply?: string;
  interactiveButtons?: VeiculoProcedenciaInteractiveButtons;
}> {
  if (input.hasInboundMedia) return { handled: false };
  if (!isGestaoAuthorizedPhone(input.fromNumber, input.auth)) {
    return { handled: false };
  }

  const gate = await loadTenantVehicleStockGate(
    input.sb as Parameters<typeof loadTenantVehicleStockGate>[0],
    input.userId,
  );
  if (!gate.usesVehicleStock) return { handled: false };

  const text = (input.userText || "").trim();
  if (!text) return { handled: false };
  const interactive = parseMolicarInteractiveId(input.interactiveId || text);
  const interactiveAction = interactive?.split(":")[0] ?? null;
  const interactivePlate = normalizeBrazilianPlate(
    interactive?.split(":")[1],
  );

  const sb = input.sb as SupabaseClient;
  if (
    (interactiveAction === "troca" || interactiveAction === "cadastrar") &&
    interactivePlate
  ) {
    return {
      handled: true,
      reply: interactiveAction === "troca"
        ? panelReply(
          "A troca começa pelo painel; o fluxo por WhatsApp ainda não cadastra uma nova avaliação.",
          `/gestao/trocas?placa=${interactivePlate}`,
        )
        : panelReply(
          "Abra o cadastro do estoque com a placa já informada.",
          `/gestao?aba=estoque&placa=${interactivePlate}`,
        ),
    };
  }

  const pending = input.agentState.pending_procedencia_confirm as
    | PendingProcedenciaConfirm
    | undefined;

  if (pending && !pendingActive(pending)) {
    await input.saveAgentStatePatch(
      { pending_procedencia_confirm: null },
      input.agentState,
    );
  }

  const active = pendingActive(pending) ? pending : null;

  if (active) {
    if (
      interactiveAction === "procedencia_cancelar" ||
      isGestaoNegative(text)
    ) {
      await input.saveAgentStatePatch(
        { pending_procedencia_confirm: null },
        input.agentState,
      );
      return { handled: true, reply: "Ok, consulta de procedência cancelada." };
    }
    if (
      interactiveAction === "procedencia_confirmar" ||
      isGestaoAffirmative(text)
    ) {
      await input.saveAgentStatePatch(
        { pending_procedencia_confirm: null },
        input.agentState,
      );
      try {
        const run = input.dependencies?.runProcedencia ??
          runMolicarProcedenciaQuery;
        const rows = await run(sb, input.userId, {
          placa: active.placa,
          services: ["debts", "gravame", "renajud"],
          canal: "whatsapp",
        }) as Record<string, unknown>[];
        const requestId = String(rows[0]?.solicitacao_id ?? "");
        if (
          requestId &&
          rows.length &&
          rows.every((row: Record<string, unknown>) =>
            String(row.status) !== "pendente"
          )
        ) {
          await (input.dependencies?.notifyProcedencia ??
            maybeNotifyMolicarProcedenciaOwner)(
              sb,
              input.userId,
              requestId,
            );
        }
        return {
          handled: true,
          reply:
            "Consulta de procedência iniciada. Avisarei o dono quando Débitos, Gravame e Renajud terminarem.",
        };
      } catch (error) {
        const message = String((error as Error).message ?? "");
        return {
          handled: true,
          reply: /conecte a molicar/i.test(message)
            ? notConfiguredReply()
            : "Não foi possível iniciar a procedência Molicar agora. Tente novamente em instantes.",
        };
      }
    }
    return {
      handled: true,
      reply: "Toque em *Confirmar* ou *Cancelar*.",
    };
  }

  const procedurePlate = interactiveAction === "procedencia"
    ? interactivePlate
    : isProcedenciaWhatsAppRequest(text)
    ? parsePlacaFromProcedenciaText(text)
    : null;
  if (procedurePlate) {
    const confirmation = procedenciaConfirmation(procedurePlate);
    await input.saveAgentStatePatch(
      { pending_procedencia_confirm: confirmation.pending },
      input.agentState,
    );
    return {
      handled: true,
      reply: confirmation.reply,
      interactiveButtons: confirmation.buttons,
    };
  }

  const plate = parseMolicarPlateLookupText(text);
  if (!plate) return { handled: false };
  try {
    const run = input.dependencies?.runConsulta ?? runMolicarConsulta;
    const result = await run(sb, input.userId, {
      placa: plate,
      origem: "manual",
    }) as Record<string, unknown>;
    if (result.not_found === true) {
      return {
        handled: true,
        reply: "Não encontrei essa placa na Molicar. Confere as letras?",
      };
    }
    return {
      handled: true,
      reply: formatMolicarPlateResult(result),
      interactiveButtons: molicarResultButtons(plate),
    };
  } catch (error) {
    const message = String((error as Error).message ?? "");
    if (
      error instanceof MolicarDailyLimitError ||
      /limite di[aá]rio/i.test(message)
    ) {
      return {
        handled: true,
        reply:
          "A loja atingiu o limite de 30 consultas Molicar hoje. Tente novamente amanhã.",
      };
    }
    if (/conecte a molicar|conex[aã]o molicar/i.test(message)) {
      return { handled: true, reply: notConfiguredReply() };
    }
    return {
      handled: true,
      reply:
        "Não consegui consultar a Molicar agora. Tente novamente em instantes.",
    };
  }
}
