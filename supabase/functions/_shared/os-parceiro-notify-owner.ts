import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadGestaoAuthContext } from "./gestao-auth-phone.ts";
import { listarDestinatariosGiroResumo } from "./giro-resumo-whatsapp.ts";
import { decidirModoEnvioResumo, enviarGiroResumoWhatsApp } from "./giro-resumo-whatsapp.ts";
import { formatGestaoMoney } from "./gestao-format.ts";

export async function notificarDonoRespostaCotacao(
  sb: SupabaseClient,
  input: {
    supabaseUrl: string;
    serviceKey: string;
    userId: string;
    osId: string;
    osNumero: number;
    veiculoLabel: string;
    parceiroNome: string;
    valor?: number | null;
    prazoDias?: number | null;
    recusada?: boolean;
    pendentes: number;
    total: number;
  },
): Promise<void> {
  const phones = await listarDestinatariosGiroResumo(sb, input.userId);
  if (!phones.length) return;

  const painelPath = `/gestao/operacoes/${input.osId}`;
  const baseUrl = Deno.env.get("PUBLIC_APP_URL")?.replace(/\/$/, "") ?? "";
  const link = baseUrl ? `${baseUrl}${painelPath}` : painelPath;

  let corpo: string;
  if (input.recusada) {
    corpo = `🔧 ${input.parceiroNome} recusou a cotação do ${input.veiculoLabel} (OS ${input.osNumero}).`;
  } else {
    const val = input.valor != null ? formatGestaoMoney(input.valor) : "—";
    const prazo = input.prazoDias != null ? `${input.prazoDias} dias` : "—";
    corpo = `🔧 ${input.parceiroNome} respondeu a cotação do ${input.veiculoLabel} (OS ${input.osNumero}): ${val} · ${prazo}. Faltam ${input.pendentes} de ${input.total}.`;
  }
  corpo += `\n${link}`;

  for (const phone of phones) {
    await enviarGiroResumoWhatsApp(sb, {
      supabaseUrl: input.supabaseUrl,
      serviceKey: input.serviceKey,
      userId: input.userId,
      phone,
      message: corpo,
    });
  }
}

export { decidirModoEnvioResumo, loadGestaoAuthContext };
