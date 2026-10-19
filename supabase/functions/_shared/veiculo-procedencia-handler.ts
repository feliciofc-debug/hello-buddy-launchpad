import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  CONSULTAR_PLACA_TESTE,
  consultarPlacaGet,
  consultarPlacaSaldo,
  isValidBrazilPlaca,
  PROCEDENCIA_CUSTO_ESTIMADO_BRL,
} from "./consultar-placa-client.ts";
import {
  createProcedenciaConsultaProcessando,
  credsFromConfig,
  loadProcedenciaConfig,
  procedenciaCompetenciaAtual,
  procedenciaCompetenciaUtcBounds,
  procedenciaConfigPublic,
  scheduleProcedenciaPainelBackground,
  countConsultasMes,
  saveProcedenciaCredential,
} from "./veiculo-procedencia-core.ts";

type User = { id: string; email?: string | null };

export type ProcedenciaHandlerResult = {
  status: number;
  body: Record<string, unknown>;
};

export async function handleVeiculoProcedenciaAction(
  body: Record<string, unknown>,
  user: User | null,
  admin: SupabaseClient,
): Promise<ProcedenciaHandlerResult> {
  const action = String(body?.action ?? "").trim();

  if (!user) {
    return { status: 401, body: { success: false, error: "Não autenticado" } };
  }

  if (action === "processar_job") {
    return { status: 400, body: { success: false, error: "Ação inválida" } };
  }

  try {
    if (action === "status") {
      const cfg = await loadProcedenciaConfig(admin, user.id);
      const ym = procedenciaCompetenciaAtual();
      const usadas = cfg ? await countConsultasMes(admin, user.id, ym) : 0;
      return {
        status: 200,
        body: {
          success: true,
          ...procedenciaConfigPublic(cfg),
          consultas_mes: usadas,
          custo_estimado: PROCEDENCIA_CUSTO_ESTIMADO_BRL,
        },
      };
    }

    if (action === "status_consulta") {
      const consultaId = String(body?.consulta_id ?? "");
      if (!consultaId) throw new Error("consulta_id obrigatório");
      const { data } = await admin.from("veiculo_procedencia_consulta")
        .select(
          "id, placa, status, resumo_json, erro_tipo, custo_estimado, created_at, concluida_em",
        )
        .eq("id", consultaId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) {
        return { status: 404, body: { success: false, error: "Consulta não encontrada" } };
      }
      return { status: 200, body: { success: true, consulta: data } };
    }

    if (action === "salvar_credencial") {
      await saveProcedenciaCredential(
        admin,
        user.id,
        String(body?.email ?? ""),
        String(body?.api_key ?? ""),
        body?.limite_mensal != null ? Number(body.limite_mensal) : undefined,
      );
      return { status: 200, body: { success: true, message: "Credenciais salvas." } };
    }

    if (action === "saldo") {
      const cfg = await loadProcedenciaConfig(admin, user.id);
      if (!cfg?.ativo) throw new Error("Procedência não configurada.");
      const creds = await credsFromConfig(cfg);
      const saldo = await consultarPlacaSaldo(creds);
      if (!saldo.ok) throw new Error("Não foi possível consultar saldo.");
      return { status: 200, body: { success: true, saldo: saldo.saldo } };
    }

    if (action === "testar") {
      const cfg = await loadProcedenciaConfig(admin, user.id);
      if (!cfg?.ativo) throw new Error("Salve as credenciais antes de testar.");
      const creds = await credsFromConfig(cfg);
      const saldo = await consultarPlacaSaldo(creds);
      const placa = await consultarPlacaGet(creds, "/consultarPlaca", CONSULTAR_PLACA_TESTE, 90_000);
      if (!placa.ok && placa.tipoErro !== "placa_nao_encontrada") {
        throw new Error("Falha no teste com placa AAA0000.");
      }
      return {
        status: 200,
        body: {
          success: true,
          saldo: saldo.saldo,
          message: "Conexão OK (placa de teste).",
        },
      };
    }

    if (action === "listar_consultas") {
      const limit = Math.min(50, Math.max(1, Number(body?.limit ?? 20)));
      const ym = String(body?.competencia ?? procedenciaCompetenciaAtual());
      const { startIso, endExclusiveIso } = procedenciaCompetenciaUtcBounds(ym);
      const { data } = await admin.from("veiculo_procedencia_consulta")
        .select(
          "id, placa, veiculo_id, solicitado_por, canal, status, resumo_json, custo_estimado, erro_tipo, created_at, concluida_em",
        )
        .eq("user_id", user.id)
        .gte("created_at", startIso)
        .lt("created_at", endExclusiveIso)
        .order("created_at", { ascending: false })
        .limit(limit);
      return { status: 200, body: { success: true, lista: data ?? [] } };
    }

    if (action === "ultima_veiculo") {
      const veiculoId = String(body?.veiculo_id ?? "");
      if (!veiculoId) throw new Error("veiculo_id obrigatório");
      const { data } = await admin.from("veiculo_procedencia_consulta")
        .select("id, placa, status, resumo_json, created_at, erro_tipo")
        .eq("user_id", user.id)
        .eq("veiculo_id", veiculoId)
        .eq("status", "concluida")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { status: 200, body: { success: true, consulta: data ?? null } };
    }

    if (action === "consultar") {
      if (body?.confirmado !== true && body?.confirmado !== "true") {
        throw new Error("Confirme o custo antes de consultar (confirmado: true).");
      }
      const placa = String(body?.placa ?? "");
      if (!isValidBrazilPlaca(placa)) throw new Error("Placa inválida.");
      const veiculoId = body?.veiculo_id ? String(body.veiculo_id) : null;
      const consultaId = await createProcedenciaConsultaProcessando(admin, user.id, placa, {
        canal: "painel",
        solicitadoPor: user.id,
        veiculoId,
      });
      scheduleProcedenciaPainelBackground(admin, user.id, consultaId, placa, {
        solicitadoPor: user.id,
        veiculoId,
      });
      return {
        status: 200,
        body: {
          success: true,
          consulta_id: consultaId,
          status: "processando",
        },
      };
    }

    return { status: 400, body: { success: false, error: "Ação inválida" } };
  } catch (e) {
    return { status: 422, body: { success: false, error: (e as Error).message } };
  }
}
