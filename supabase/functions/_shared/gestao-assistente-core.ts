import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { classifyGestaoIntent } from "./gestao-intent-pt.ts";
import {
  closestGestaoAssistenteEntries,
  GESTAO_ASSISTENTE_MAP,
  matchGestaoAssistenteNavigation,
  type GestaoAssistenteMapEntry,
} from "./gestao-assistente-map.ts";
import {
  isGestaoAssistenteMutatingIntent,
  matchEstoqueValoresQuestion,
  runGestaoAssistenteEstoqueValores,
  runGestaoAssistenteQuery,
} from "./gestao-assistente-queries.ts";
import { gestaoAssistentePolishReply } from "./gestao-assistente-ai.ts";

export type Db = SupabaseClient;

export type GestaoAssistenteAction = { label: string; path: string };

export type GestaoAssistenteResponse = {
  success: boolean;
  reply: string;
  actions: GestaoAssistenteAction[];
  error?: string;
};

function navActions(entry: GestaoAssistenteMapEntry): GestaoAssistenteAction[] {
  return [{ label: entry.title, path: entry.path }];
}

function formatNavReply(entry: GestaoAssistenteMapEntry): string {
  const steps = entry.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `${entry.title} — ${entry.purpose}\n\nPasso a passo:\n${steps}`;
}

const MUTATION_NAV: Partial<Record<string, GestaoAssistenteMapEntry["id"]>> = {
  nfe_emit: "emitir-nota",
  venda: "estoque",
  despesa: "estoque",
  compra: "estoque",
  pacote_contador: "resultado",
  revogar_link_contador: "resultado",
};

export async function handleGestaoAssistenteMessage(
  sb: Db,
  userId: string,
  message: string,
): Promise<GestaoAssistenteResponse> {
  const text = message.trim();
  if (!text) {
    return { success: false, reply: "Digite ou fale sua pergunta.", actions: [], error: "empty" };
  }

  const intent = classifyGestaoIntent(text);
  if (isGestaoAssistenteMutatingIntent(intent.kind)) {
    const navId = MUTATION_NAV[intent.kind];
    const entry = navId
      ? GESTAO_ASSISTENTE_MAP.find((e) => e.id === navId) ?? matchGestaoAssistenteNavigation(text)
      : matchGestaoAssistenteNavigation(text);
    const fallback = entry ?? GESTAO_ASSISTENTE_MAP.find((e) => e.id === "estoque")!;
    return {
      success: true,
      reply:
        "Por aqui eu só explico e te levo na tela certa — não lanço, emito nem pago pelo chat.\n\n" +
        formatNavReply(fallback),
      actions: navActions(fallback),
    };
  }

  if (matchEstoqueValoresQuestion(text)) {
    const q = await runGestaoAssistenteEstoqueValores(sb, userId);
    const nav = matchGestaoAssistenteNavigation("estoque")!;
    return {
      success: true,
      reply: await gestaoAssistentePolishReply(text, q.reply, navActions(nav)),
      actions: navActions(nav),
    };
  }

  const query = await runGestaoAssistenteQuery(sb, userId, text);
  if (query) {
    const nav = matchGestaoAssistenteNavigation(text) ?? closestGestaoAssistenteEntries(text, 1)[0];
    const actions = nav ? navActions(nav) : [{ label: "Abrir Gestão", path: "/gestao/lucro" }];
    return {
      success: true,
      reply: await gestaoAssistentePolishReply(text, query.reply, actions),
      actions,
    };
  }

  const nav = matchGestaoAssistenteNavigation(text);
  if (nav) {
    return {
      success: true,
      reply: formatNavReply(nav),
      actions: navActions(nav),
    };
  }

  const closest = closestGestaoAssistenteEntries(text, 2);
  if (closest.length) {
    return {
      success: true,
      reply: "Não encontrei isso no sistema. O mais perto:\n\n" +
        closest.map((c) => `• ${c.title} — ${c.purpose}`).join("\n"),
      actions: closest.map((c) => ({ label: c.title, path: c.path })),
    };
  }

  return {
    success: true,
    reply: "Não encontrei isso no sistema. Posso ajudar com Gestão, notas, vendas, financeiro ou estoque.",
    actions: [
      { label: "Abrir Gestão", path: "/gestao/lucro" },
      { label: "Estoque vitrine", path: "/veiculos" },
    ],
  };
}
