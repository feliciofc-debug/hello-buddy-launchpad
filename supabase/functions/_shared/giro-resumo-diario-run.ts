import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { competenciaFromYmdSaoPaulo, hojeSaoPaulo } from "./gestao-date-br.ts";
import { runGiroFipeAutoMes } from "./giro-fipe-refresh-run.ts";
import { loadGiroResumoItens } from "./giro-resumo-load.ts";
import {
  agregarGiroResumo,
  horaResumoAtingida,
  montarMensagemGiroResumo,
  resumoJaEnviadoHoje,
} from "./giro-resumo-mensagem.ts";
import { resolveTenantOwner, tenantOwnerMatchesPhone } from "./amz-context.ts";
import {
  enviarGiroResumoWhatsApp,
  listarDestinatariosGiroResumo,
} from "./giro-resumo-whatsapp.ts";
import { dateKeySaoPaulo } from "./vitrine-crm-time.ts";

export type GiroResumoDiarioEnv = {
  supabaseUrl: string;
  serviceKey: string;
};

export type GiroResumoLojaResult = {
  user_id: string;
  status: "ignorado" | "aguardando_hora" | "ja_enviado" | "sem_destinatario" | "enviado" | "falha_envio";
  preview?: string;
  envios?: Array<{ phone: string; ok: boolean; mode: string; templateNome?: string; error?: string }>;
  fipe_auto?: { rodadas: number; gravados: number };
  motivo?: string;
};

async function maybeRunFipeAuto(
  sb: SupabaseClient,
  userId: string,
  fipeUltima: string | null,
): Promise<{ rodadas: number; gravados: number } | null> {
  const competencia = competenciaFromYmdSaoPaulo();
  if (fipeUltima === competencia) return null;
  const r = await runGiroFipeAutoMes(sb, userId, 8);
  await sb.from("gestao_giro_config").update({
    fipe_auto_ultima_competencia: competencia,
  }).eq("user_id", userId);
  return r;
}

export async function processarGiroResumoLoja(
  sb: SupabaseClient,
  env: GiroResumoDiarioEnv,
  userId: string,
  now = new Date(),
): Promise<GiroResumoLojaResult> {
  const hojeYmd = dateKeySaoPaulo(now);
  const { data: cfgRow } = await sb.from("gestao_giro_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!cfgRow?.resumo_diario_ativo) {
    return { user_id: userId, status: "ignorado", motivo: "resumo desativado" };
  }
  if (resumoJaEnviadoHoje(cfgRow.resumo_ultimo_envio ?? null, hojeYmd)) {
    return { user_id: userId, status: "ja_enviado" };
  }
  const horaCfg = String(cfgRow.resumo_diario_hora ?? "18:00:00");
  if (!horaResumoAtingida(horaCfg, now)) {
    return { user_id: userId, status: "aguardando_hora" };
  }

  const fipeAuto = await maybeRunFipeAuto(
    sb,
    userId,
    cfgRow.fipe_auto_ultima_competencia ?? null,
  );

  const { items } = await loadGiroResumoItens(sb, userId, hojeSaoPaulo());
  const agregado = agregarGiroResumo(items, hojeYmd);
  const message = montarMensagemGiroResumo(agregado, hojeYmd);

  const phones = await listarDestinatariosGiroResumo(sb, userId);
  if (!phones.length) {
    return { user_id: userId, status: "sem_destinatario", preview: message.slice(0, 200) };
  }

  const owner = await resolveTenantOwner(sb, userId);
  const envios = [];
  let ownerOk = false;
  for (const phone of phones) {
    const r = await enviarGiroResumoWhatsApp(sb, {
      supabaseUrl: env.supabaseUrl,
      serviceKey: env.serviceKey,
      userId,
      phone,
      message,
    });
    envios.push({
      phone: r.phone,
      ok: r.ok,
      mode: r.mode,
      templateNome: r.templateNome,
      error: r.error,
    });
    if (r.ok && tenantOwnerMatchesPhone(owner, r.phone)) ownerOk = true;
  }

  if (!ownerOk) {
    const allBlocked = envios.every((e) => !e.ok && e.error?.includes("janela 24h"));
    return {
      user_id: userId,
      status: "falha_envio",
      preview: message,
      envios,
      fipe_auto: fipeAuto ?? undefined,
      motivo: allBlocked ? "fora da janela 24h" : "falha no envio ao dono",
    };
  }

  await sb.from("gestao_giro_config").update({
    resumo_ultimo_envio: hojeYmd,
  }).eq("user_id", userId);

  return {
    user_id: userId,
    status: "enviado",
    preview: message,
    envios,
    fipe_auto: fipeAuto ?? undefined,
  };
}

export async function runGiroResumoDiario(
  sb: SupabaseClient,
  env: GiroResumoDiarioEnv,
  now = new Date(),
): Promise<GiroResumoLojaResult[]> {
  const { data: lojas } = await sb.from("gestao_giro_config")
    .select("user_id")
    .eq("resumo_diario_ativo", true);
  const results: GiroResumoLojaResult[] = [];
  for (const row of lojas ?? []) {
    try {
      results.push(await processarGiroResumoLoja(sb, env, String(row.user_id), now));
    } catch (e) {
      results.push({
        user_id: String(row.user_id),
        status: "falha_envio",
        motivo: (e as Error).message,
      });
    }
  }
  return results;
}
