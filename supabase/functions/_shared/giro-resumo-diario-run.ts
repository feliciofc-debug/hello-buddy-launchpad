import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { competenciaFromYmdSaoPaulo, hojeSaoPaulo } from "./gestao-date-br.ts";
import { runGiroFipeAutoMes } from "./giro-fipe-refresh-run.ts";
import {
  classificarStatusResumo,
  deveProcessarResumoHoje,
  filtrarPhonesSemEnvio,
  mergePhonesOk,
  todosFalharamTecnico,
  type GiroResumoUltimoStatus,
} from "./giro-resumo-diario-policy.ts";
import { loadGiroResumoItens } from "./giro-resumo-load.ts";
import {
  agregarGiroResumo,
  horaResumoAtingida,
  montarMensagemGiroResumo,
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
  resumo_status?: GiroResumoUltimoStatus;
  preview?: string;
  envios?: Array<{ phone: string; ok: boolean; mode: string; templateNome?: string; error?: string }>;
  fipe_auto?: { rodadas: number; gravados: number };
  motivo?: string;
};

type ConfigRow = {
  resumo_diario_ativo: boolean;
  resumo_diario_hora: string;
  resumo_ultimo_envio: string | null;
  resumo_ultimo_status: GiroResumoUltimoStatus | null;
  resumo_tentativas_tecnico: number;
  resumo_phones_ok: string[] | null;
  fipe_auto_ultima_competencia: string | null;
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

async function persistirTentativaResumo(
  sb: SupabaseClient,
  userId: string,
  input: {
    hojeYmd: string;
    status: GiroResumoUltimoStatus;
    phonesOk: string[];
    tentativasTecnico: number;
    primeiraDoDia: boolean;
  },
) {
  await sb.from("gestao_giro_config").update({
    resumo_ultimo_envio: input.hojeYmd,
    resumo_ultimo_status: input.status,
    resumo_phones_ok: input.phonesOk,
    resumo_tentativas_tecnico: input.tentativasTecnico,
  }).eq("user_id", userId);
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
  const cfg = cfgRow as ConfigRow | null;
  if (!cfg?.resumo_diario_ativo) {
    return { user_id: userId, status: "ignorado", motivo: "resumo desativado" };
  }

  const horaCfg = String(cfg.resumo_diario_hora ?? "18:00:00");
  if (!horaResumoAtingida(horaCfg, now)) {
    return { user_id: userId, status: "aguardando_hora" };
  }

  const phonesOkAnteriores = cfg.resumo_ultimo_envio === hojeYmd
    ? (cfg.resumo_phones_ok ?? [])
    : [];
  let tentativasTecnico = cfg.resumo_ultimo_envio === hojeYmd
    ? Number(cfg.resumo_tentativas_tecnico ?? 0)
    : 0;

  const modo = deveProcessarResumoHoje({
    hojeYmd,
    resumoUltimoEnvio: cfg.resumo_ultimo_envio,
    resumoUltimoStatus: cfg.resumo_ultimo_status,
    tentativasTecnico,
  });

  if (modo === "nao") {
    return {
      user_id: userId,
      status: "ja_enviado",
      resumo_status: cfg.resumo_ultimo_status ?? undefined,
    };
  }

  const primeiraDoDia = modo === "primeira_tentativa";
  if (primeiraDoDia) {
    tentativasTecnico = 0;
  } else {
    tentativasTecnico += 1;
  }

  const fipeAuto = primeiraDoDia
    ? await maybeRunFipeAuto(sb, userId, cfg.fipe_auto_ultima_competencia ?? null)
    : null;

  const { items } = await loadGiroResumoItens(sb, userId, hojeSaoPaulo());
  const agregado = agregarGiroResumo(items, hojeYmd);
  const message = montarMensagemGiroResumo(agregado, hojeYmd);

  const phonesAll = await listarDestinatariosGiroResumo(sb, userId);
  const phones = filtrarPhonesSemEnvio(phonesAll, phonesOkAnteriores);
  if (!phones.length && !primeiraDoDia) {
    return {
      user_id: userId,
      status: "ja_enviado",
      resumo_status: cfg.resumo_ultimo_status ?? undefined,
    };
  }
  if (!phonesAll.length) {
    if (primeiraDoDia) {
      await persistirTentativaResumo(sb, userId, {
        hojeYmd,
        status: "falha",
        phonesOk: [],
        tentativasTecnico: 0,
        primeiraDoDia: true,
      });
    }
    return { user_id: userId, status: "sem_destinatario", preview: message.slice(0, 200) };
  }

  const owner = await resolveTenantOwner(sb, userId);
  const envios = [];
  let ownerOk = false;
  let ownerBlocked24h = false;

  for (const phone of phones) {
    const r = await enviarGiroResumoWhatsApp(sb, {
      supabaseUrl: env.supabaseUrl,
      serviceKey: env.serviceKey,
      userId,
      phone,
      message,
      agregado,
      hojeYmd,
    });
    envios.push({
      phone: r.phone,
      ok: r.ok,
      mode: r.mode,
      templateNome: r.templateNome,
      error: r.error,
    });
    if (r.ok && tenantOwnerMatchesPhone(owner, r.phone)) ownerOk = true;
    if (!r.ok && tenantOwnerMatchesPhone(owner, r.phone) &&
      String(r.error ?? "").includes("janela 24h")) {
      ownerBlocked24h = true;
    }
  }

  const novosOk = envios.filter((e) => e.ok).map((e) => e.phone);
  const phonesOk = mergePhonesOk(phonesOkAnteriores, novosOk);
  const algumOk = phonesOk.length > 0;
  const resumoStatus = classificarStatusResumo({ ownerOk, ownerBlocked24h, algumOk });

  const falhaTecnicaTotal = envios.length > 0 && todosFalharamTecnico(envios) && !algumOk;
  let tentativasFinal = tentativasTecnico;
  if (falhaTecnicaTotal) {
    tentativasFinal = primeiraDoDia ? 0 : tentativasTecnico;
  } else if (!primeiraDoDia) {
    tentativasFinal = tentativasTecnico;
  } else {
    tentativasFinal = 0;
  }

  if (primeiraDoDia || envios.length > 0) {
    await persistirTentativaResumo(sb, userId, {
      hojeYmd,
      status: resumoStatus,
      phonesOk,
      tentativasTecnico: tentativasFinal,
      primeiraDoDia,
    });
  }

  return {
    user_id: userId,
    status: ownerOk ? "enviado" : "falha_envio",
    resumo_status: resumoStatus,
    preview: message,
    envios,
    fipe_auto: fipeAuto ?? undefined,
    motivo: ownerOk ? undefined : (ownerBlocked24h ? "fora da janela 24h" : "falha no envio ao dono"),
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
        resumo_status: "falha",
        motivo: (e as Error).message,
      });
    }
  }
  return results;
}
