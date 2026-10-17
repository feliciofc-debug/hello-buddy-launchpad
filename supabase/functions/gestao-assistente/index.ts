import {
  gestaoZapsignAdminClient,
  gestaoZapsignAuthedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/gestao-zapsign-http.ts";
import { loadTenantVehicleStockGate } from "../_shared/vehicle-inventory-tenant.ts";
import { handleGestaoAssistenteMessage } from "../_shared/gestao-assistente-core.ts";

type HistoryTurn = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await gestaoZapsignAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);

    const gate = await loadTenantVehicleStockGate(gestaoZapsignAdminClient(), user.id);
    if (!gate.usesVehicleStock && !gate.vitrine_veiculos_demo) {
      return jsonResponse({
        success: false,
        error: "Jarvis da Gestão disponível para revendas de veículos.",
      }, 403);
    }

    const body = await req.json().catch(() => ({})) as {
      message?: string;
      history?: HistoryTurn[];
    };

    const message = String(body.message ?? "").trim();
    if (!message) {
      return jsonResponse({ success: false, error: "Mensagem vazia.", actions: [] }, 400);
    }

    // Histórico só na sessão (cliente envia; servidor não persiste — sem PII em log).
    void body.history;

    const admin = gestaoZapsignAdminClient();
    const result = await handleGestaoAssistenteMessage(admin, user.id, message);
    return jsonResponse(result);
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message, actions: [] }, 422);
  }
});
