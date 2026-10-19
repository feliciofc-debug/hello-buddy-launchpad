import {
  CONSULTAR_PLACA_TESTE,
  consultarPlacaGet,
  consultarPlacaSaldo,
  isValidBrazilPlaca,
  PROCEDENCIA_CUSTO_ESTIMADO_BRL,
} from "../_shared/consultar-placa-client.ts";
import {
  credsFromConfig,
  loadProcedenciaConfig,
  procedenciaConfigPublic,
  runProcedenciaConsulta,
  saveProcedenciaCredential,
  countConsultasMes,
} from "../_shared/veiculo-procedencia-core.ts";
import {
  jsonResponse,
  optionsResponse,
  procedenciaAdminClient,
  procedenciaAuthedUser,
} from "../_shared/procedencia-http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim();

    if (action === "processar_job") {
      const admin = procedenciaAdminClient();
      const consultaId = String(body?.consulta_id ?? "");
      const userId = String(body?.user_id ?? "");
      const fromNumber = String(body?.from_number ?? "");
      if (!consultaId || !userId) {
        return jsonResponse({ success: false, error: "Parâmetros inválidos" }, 422);
      }
      const { data: row } = await admin.from("veiculo_procedencia_consulta")
        .select("placa, veiculo_id, solicitado_por, canal")
        .eq("id", consultaId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!row) return jsonResponse({ success: false, error: "Consulta não encontrada" }, 404);
      const result = await runProcedenciaConsulta(admin, userId, String(row.placa), {
        canal: row.canal === "whatsapp" ? "whatsapp" : "painel",
        solicitadoPor: String(row.solicitado_por),
        veiculoId: row.veiculo_id,
        consultaId,
      });
      if (fromNumber && row.canal === "whatsapp") {
        const { formatProcedenciaWhatsApp, sendProcedenciaWhatsAppReply } = await import(
          "../_shared/veiculo-procedencia-core.ts"
        );
        const msg = formatProcedenciaWhatsApp(String(row.placa), result.resumo, {
          teste: String(row.placa).toUpperCase() === CONSULTAR_PLACA_TESTE,
        });
        await sendProcedenciaWhatsAppReply(admin, userId, fromNumber, msg);
      }
      return jsonResponse({ success: true, resumo: result.resumo, consulta_id: consultaId });
    }

    const { user } = await procedenciaAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    const admin = procedenciaAdminClient();

    if (action === "status") {
      const cfg = await loadProcedenciaConfig(admin, user.id);
      const ym = new Date().toISOString().slice(0, 7);
      const usadas = cfg ? await countConsultasMes(admin, user.id, ym) : 0;
      return jsonResponse({
        success: true,
        ...procedenciaConfigPublic(cfg),
        consultas_mes: usadas,
        custo_estimado: PROCEDENCIA_CUSTO_ESTIMADO_BRL,
      });
    }

    if (action === "salvar_credencial") {
      await saveProcedenciaCredential(
        admin,
        user.id,
        String(body?.email ?? ""),
        String(body?.api_key ?? ""),
        body?.limite_mensal != null ? Number(body.limite_mensal) : undefined,
      );
      return jsonResponse({ success: true, message: "Credenciais salvas." });
    }

    if (action === "saldo") {
      const cfg = await loadProcedenciaConfig(admin, user.id);
      if (!cfg?.ativo) throw new Error("Procedência não configurada.");
      const creds = await credsFromConfig(cfg);
      const saldo = await consultarPlacaSaldo(creds);
      if (!saldo.ok) throw new Error("Não foi possível consultar saldo.");
      return jsonResponse({ success: true, saldo: saldo.saldo });
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
      return jsonResponse({
        success: true,
        saldo: saldo.saldo,
        message: "Conexão OK (placa de teste).",
      });
    }

    if (action === "listar_consultas") {
      const limit = Math.min(50, Math.max(1, Number(body?.limit ?? 20)));
      const ym = String(body?.competencia ?? new Date().toISOString().slice(0, 7));
      const start = `${ym}-01T00:00:00.000Z`;
      const [y, m] = ym.split("-").map(Number);
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const end = `${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00.000Z`;
      const { data } = await admin.from("veiculo_procedencia_consulta")
        .select(
          "id, placa, veiculo_id, solicitado_por, canal, status, resumo_json, custo_estimado, erro_tipo, created_at, concluida_em",
        )
        .eq("user_id", user.id)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false })
        .limit(limit);
      return jsonResponse({ success: true, lista: data ?? [] });
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
      return jsonResponse({ success: true, consulta: data ?? null });
    }

    if (action === "consultar") {
      if (body?.confirmado !== true && body?.confirmado !== "true") {
        throw new Error("Confirme o custo antes de consultar (confirmado: true).");
      }
      const placa = String(body?.placa ?? "");
      if (!isValidBrazilPlaca(placa)) throw new Error("Placa inválida.");
      const veiculoId = body?.veiculo_id ? String(body.veiculo_id) : null;
      const result = await runProcedenciaConsulta(admin, user.id, placa, {
        canal: "painel",
        solicitadoPor: user.id,
        veiculoId,
      });
      return jsonResponse({
        success: true,
        consulta_id: result.consultaId,
        resumo: result.resumo,
      });
    }

    return jsonResponse({ success: false, error: "Ação inválida" }, 400);
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
