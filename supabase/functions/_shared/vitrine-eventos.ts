import { normalizePhoneBR } from "./cloud-log.ts";

export const VITRINE_EVENTOS = [
  "marca",
  "faixa",
  "detalhe",
  "fotos",
  "interesse",
  "consultor",
  "visita",
  "financiamento",
  "troca",
] as const;

export type VitrineEvento = typeof VITRINE_EVENTOS[number];

export const VITRINE_WARM_EVENTS = new Set<VitrineEvento>(["detalhe", "fotos"]);

export const VITRINE_CONVERSION_EVENTS = new Set<VitrineEvento>([
  "interesse",
  "consultor",
  "visita",
  "financiamento",
  "troca",
]);

export type VitrineEventoRow = {
  veiculo_id: string | null;
  evento: string;
  created_at: string;
};

export async function insertVitrineEvento(
  sb: { from: (t: string) => unknown },
  input: {
    userId: string;
    contactNumber: string;
    evento: VitrineEvento;
    veiculoId?: string | null;
  },
): Promise<void> {
  try {
    const phone = normalizePhoneBR(input.contactNumber);
    if (!input.userId || !phone) return;
    const client = sb as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error?: { message: string } | null }>;
      };
    };
    const { error } = await client.from("vitrine_eventos").insert({
      user_id: input.userId,
      contact_number: phone,
      veiculo_id: input.veiculoId ?? null,
      evento: input.evento,
    });
    if (error) {
      console.error("[vitrine-eventos] insert:", error.message);
    }
  } catch (e) {
    console.error("[vitrine-eventos] insert falhou:", (e as Error).message);
  }
}
