import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  filterSnapshotByFoco,
  loadGestaoConsultaSnapshot,
  parseGestaoConsultaFocoArg,
  parseGestaoConsultaPeriodoArg,
} from "./gestao-consulta-snapshot.ts";

export const CONSULTAR_DADOS_LOJA_TOOL_NAME = "consultar_dados_loja";

export type ToolDefinition = {
  type: string;
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export const CONSULTAR_DADOS_LOJA_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: CONSULTAR_DADOS_LOJA_TOOL_NAME,
    description:
      "Consulta SOMENTE LEITURA dos dados da loja (vendas, estoque, despesas, contas, lucro/DRE, metas, vendedores, leads, conversas, NF-e). Use antes de responder qualquer pergunta do dono/gestor sobre números da loja.",
    parameters: {
      type: "object",
      properties: {
        periodo: {
          type: "string",
          enum: ["hoje", "ontem", "semana", "mes", "mes_anterior", "ano"],
          description: "Janela de tempo (padrão: mes). Datas em America/Sao_Paulo.",
        },
        foco: {
          type: "string",
          enum: [
            "vendas", "estoque", "despesas", "contas", "conciliacao", "dre", "meta",
            "vendedores", "leads", "conversas", "notas", "tudo",
          ],
          description: "Recorte do snapshot (padrão: tudo).",
        },
      },
    },
  },
};

export function filterGestaoConsultaTools<T extends ToolDefinition>(
  tools: T[],
  gestaoConsultaEnabled: boolean,
): T[] {
  if (gestaoConsultaEnabled) return tools;
  return tools.filter((t) => t?.function?.name !== CONSULTAR_DADOS_LOJA_TOOL_NAME);
}

export async function runConsultarDadosLojaTool(
  sb: SupabaseClient,
  storeUserId: string,
  args: { periodo?: string; foco?: string },
): Promise<string> {
  const periodo = parseGestaoConsultaPeriodoArg(args?.periodo);
  const foco = parseGestaoConsultaFocoArg(args?.foco);
  const snap = await loadGestaoConsultaSnapshot(sb, storeUserId, periodo);
  const filtered = filterSnapshotByFoco(snap, foco);
  return JSON.stringify(filtered);
}

export const GESTAO_CONSULTA_SYSTEM_BLOCK =
  "DADOS DA LOJA (OBRIGATÓRIO):\n" +
  "- Para perguntas sobre a loja (vendas, estoque, carros, despesas, contas, lucro, vendedores, leads, metas, notas), SEMPRE chame consultar_dados_loja antes de responder.\n" +
  "- Responda só com o que veio no resultado; se o dado não existir, diga \"não tenho esse dado na plataforma\".\n" +
  "- Nunca invente números. Nunca use pesquisa web para dados da loja.\n" +
  "- Formato WhatsApp: curto, listas numeradas, valores em R$ pt-BR, plural correto (1 carro / N carros).";

export const GESTAO_CONSULTA_FALLBACK_TEXT =
  "Não consegui puxar esse dado agora. Tenta perguntar de outro jeito, ex.: \"quais carros vendemos esse mês?\"";
