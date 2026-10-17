import { resolveTenantOwner } from "./amz-context.ts";
import { vehicleDisplayTitle, type VeiculoVitrineRow } from "./vehicle-stock-whatsapp.ts";

const CONTACT_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  call: "ligação",
  question: "pergunta",
  visit_request: "visita",
  contact_request: "contato",
  reservation: "reserva",
  credit: "financiamento",
  quotations: "orçamento",
};

export function mlLeadContactLabel(contactType: string): string {
  return CONTACT_LABEL[contactType] ?? contactType;
}

export function buildMlLeadOwnerMessage(input: {
  buyerName?: string | null;
  contactType: string;
  vehicleTitle: string;
  permalink?: string | null;
  buyerPhone?: string | null;
  buyerEmail?: string | null;
  isGuest?: boolean;
}): string {
  if (input.isGuest) {
    const tipo = mlLeadContactLabel(input.contactType);
    const lines = [`👀 Um visitante clicou em ${tipo} no anúncio do ${input.vehicleTitle}.`];
    if (input.permalink) lines.push(input.permalink);
    return lines.join("\n");
  }
  const nome = String(input.buyerName || "Cliente").trim();
  const tipo = mlLeadContactLabel(input.contactType);
  const lines = [`🛒 Mercado Livre — ${nome} pediu ${tipo} no ${input.vehicleTitle}.`];
  const contato = [input.buyerPhone, input.buyerEmail].filter(Boolean).join(" · ");
  if (contato) lines.push(contato);
  if (input.permalink) lines.push(input.permalink);
  return lines.join("\n");
}

export async function sendMlOwnerNotify(
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
    return res.ok && j?.success === true;
  } catch {
    return false;
  }
}

export function vehicleTitleFromRow(v: Partial<VeiculoVitrineRow>): string {
  if (!v.marca) return "veículo";
  return vehicleDisplayTitle(v as VeiculoVitrineRow);
}
