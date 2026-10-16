import { resolveTenantOwner } from "./amz-context.ts";

/** Alerta ao dono via whatsapp-send-message (type:text, sem template_name).
 *  Fora da janela de 24h da Meta (dono não iniciou conversa recente), a API
 *  rejeita texto livre → success:false / HTTP 4xx; não há fallback automático. */

export async function sendVitrineCrmOwnerText(
  sb: unknown,
  input: {
    supabaseUrl: string;
    serviceKey: string;
    userId: string;
    message: string;
  },
): Promise<boolean> {
  const owner = await resolveTenantOwner(sb as never, input.userId);
  if (!owner.phone) return false;
  try {
    const res = await fetch(`${input.supabaseUrl}/functions/v1/whatsapp-send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.serviceKey}`,
        apikey: input.serviceKey,
      },
      body: JSON.stringify({
        user_id: input.userId,
        to: owner.phone,
        message: input.message,
        log_sender: "agent",
      }),
    });
    const j = await res.json().catch(() => ({}));
    const ok = res.ok && j?.success === true;
    if (!ok) {
      console.warn("[vitrine-crm] owner send rejected:", j?.error ?? j?.message ?? res.status);
    }
    return ok;
  } catch (e) {
    console.error("[vitrine-crm] owner send:", (e as Error).message);
    return false;
  }
}

export async function sendVitrineRetomadaCliente(
  input: {
    supabaseUrl: string;
    serviceKey: string;
    userId: string;
    to: string;
    body: string;
    vehicleId: string;
  },
): Promise<boolean> {
  const { vitrineButtonId } = await import("./vehicle-stock-whatsapp.ts");
  try {
    const res = await fetch(`${input.supabaseUrl}/functions/v1/whatsapp-send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.serviceKey}`,
        apikey: input.serviceKey,
      },
      body: JSON.stringify({
        user_id: input.userId,
        to: input.to,
        message: input.body,
        log_sender: "agent",
        interactive_buttons: {
          body: input.body,
          buttons: [
            { id: vitrineButtonId("acao", `visita:${input.vehicleId}`), title: "Agendar visita" },
            { id: vitrineButtonId("consultor", input.vehicleId), title: "Falar com consultor" },
          ],
        },
      }),
    });
    const j = await res.json().catch(() => ({}));
    return res.ok && j?.success === true;
  } catch (e) {
    console.error("[vitrine-crm] retomada send:", (e as Error).message);
    return false;
  }
}
