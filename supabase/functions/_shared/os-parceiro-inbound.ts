import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadGestaoAuthContext } from "./gestao-auth-phone.ts";
import {
  deveIgnorarFluxoParceiro,
  parceiroMatchesPhone,
  type GestaoParceiroPhoneRow,
} from "./os-parceiro-routing.ts";
import {
  extractOsCotacaoWaButtonId,
  OS_COT_WA_BTN_CONFIRMAR,
  OS_COT_WA_BTN_CORRIGIR,
  OS_COT_WA_BTN_ENVIAR,
  OS_COT_WA_BTN_SEM_AGENDA,
  parseOsCotacaoWaInteractiveId,
} from "./os-parceiro-interactive.ts";
import { parseOrcamentoParceiroTexto } from "./os-parceiro-parser.ts";
import { notificarDonoRespostaCotacao } from "./os-parceiro-notify-owner.ts";
import type { MediaExtract } from "./whatsapp-media.ts";
import {
  parseOrcamentoFromExtractedText,
  salvarAudioParceiroDocumento,
  salvarOrcamentoParceiroDocumento,
  textoDeOrcamentoParceiroMedia,
} from "./os-parceiro-orcamento-media.ts";

export type OsParceiroWaResult = {
  handled: boolean;
  reply?: string;
  interactiveButtons?: {
    body: string;
    buttons: { id: string; title: string }[];
  };
  interactiveList?: {
    body: string;
    button: string;
    section_title: string;
    rows: { id: string; title: string; description: string }[];
  };
};

type Sessao = {
  id: string;
  user_id: string;
  parceiro_id: string;
  cotacao_id: string | null;
  fase: string;
  draft_json: Record<string, unknown>;
};

type CotacaoRow = {
  id: string;
  os_id: string;
  status: string;
  valor: number | null;
  prazo_dias: number | null;
};

async function findParceiro(
  sb: SupabaseClient,
  userId: string,
  fromNumber: string,
): Promise<GestaoParceiroPhoneRow | null> {
  const { data } = await sb.from("gestao_parceiro")
    .select("id,user_id,nome,whatsapp_e164,ativo")
    .eq("user_id", userId)
    .eq("ativo", true);
  for (const row of (data ?? []) as GestaoParceiroPhoneRow[]) {
    if (parceiroMatchesPhone(row, fromNumber)) return row;
  }
  return null;
}

async function cotacoesAbertas(
  sb: SupabaseClient,
  userId: string,
  parceiroId: string,
): Promise<CotacaoRow[]> {
  const { data } = await sb.from("gestao_os_cotacao")
    .select("id,os_id,status,valor,prazo_dias")
    .eq("user_id", userId)
    .eq("parceiro_id", parceiroId)
    .eq("status", "solicitada")
    .order("solicitada_em", { ascending: false });
  return (data ?? []) as CotacaoRow[];
}

async function loadSessao(
  sb: SupabaseClient,
  userId: string,
  parceiroId: string,
): Promise<Sessao | null> {
  const { data } = await sb.from("gestao_os_cotacao_wa_sessao")
    .select("*")
    .eq("user_id", userId)
    .eq("parceiro_id", parceiroId)
    .maybeSingle();
  return data as Sessao | null;
}

async function saveSessao(
  sb: SupabaseClient,
  sessao: Partial<Sessao> & { user_id: string; parceiro_id: string; fase: string },
): Promise<void> {
  await sb.from("gestao_os_cotacao_wa_sessao").upsert({
    ...sessao,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,parceiro_id" });
}

async function clearSessao(sb: SupabaseClient, userId: string, parceiroId: string): Promise<void> {
  await sb.from("gestao_os_cotacao_wa_sessao")
    .delete()
    .eq("user_id", userId)
    .eq("parceiro_id", parceiroId);
}

async function resolveCotacaoUnica(
  sb: SupabaseClient,
  userId: string,
  parceiroId: string,
  cotacaoId?: string | null,
): Promise<CotacaoRow | null> {
  const abertas = await cotacoesAbertas(sb, userId, parceiroId);
  if (!abertas.length) return null;
  if (cotacaoId) {
    return abertas.find((c) => c.id === cotacaoId) ?? null;
  }
  if (abertas.length === 1) return abertas[0];
  return null;
}

async function contagemCotacaoOs(
  sb: SupabaseClient,
  userId: string,
  osId: string,
): Promise<{ total: number; pendentes: number }> {
  const { data } = await sb.from("gestao_os_cotacao")
    .select("status")
    .eq("user_id", userId)
    .eq("os_id", osId);
  const rows = (data ?? []) as { status: string }[];
  const total = rows.filter((r) => r.status !== "descartada").length;
  const pendentes = rows.filter((r) => r.status === "solicitada").length;
  return { total, pendentes };
}

async function aplicarConfirmado(
  sb: SupabaseClient,
  input: {
    supabaseUrl: string;
    serviceKey: string;
    cotacaoId: string;
    userId: string;
    parceiroNome: string;
    draft: Record<string, unknown>;
    recusada?: boolean;
    convId?: string;
    messageId?: string;
  },
): Promise<string> {
  const status = input.recusada ? "recusada" : "recebida";
  await sb.rpc("gestao_os_cotacao_aplicar_resposta_parceiro", {
    p_cotacao_id: input.cotacaoId,
    p_status: status,
    p_valor: input.recusada ? null : Number(input.draft.valor ?? 0),
    p_prazo_dias: input.recusada ? null : (input.draft.prazo_dias == null ? null : Number(input.draft.prazo_dias)),
    p_observacao: String(input.draft.observacao ?? "") || null,
    p_transcricao: String(input.draft.transcricao ?? "") || null,
    p_whatsapp_message_id: input.messageId ?? null,
    p_whatsapp_conversation_id: input.convId ?? null,
  });

  const { data: cot } = await sb.from("gestao_os_cotacao")
    .select("os_id,valor,prazo_dias")
    .eq("id", input.cotacaoId)
    .single();
  const { data: os } = await sb.from("gestao_os")
    .select("numero,veiculo_id")
    .eq("id", cot?.os_id)
    .single();
  const { data: veiculo } = await sb.from("veiculos_estoque")
    .select("marca,modelo")
    .eq("id", os?.veiculo_id)
    .maybeSingle();
  const veiculoLabel = veiculo
    ? `${veiculo.marca} ${veiculo.modelo}`
    : "Veículo";
  const counts = cot?.os_id
    ? await contagemCotacaoOs(sb, input.userId, cot.os_id)
    : { total: 1, pendentes: 0 };

  await notificarDonoRespostaCotacao(sb, {
    supabaseUrl: input.supabaseUrl,
    serviceKey: input.serviceKey,
    userId: input.userId,
    osId: String(cot?.os_id ?? ""),
    osNumero: Number(os?.numero ?? 0),
    veiculoLabel,
    parceiroNome: input.parceiroNome,
    valor: input.recusada ? null : Number(input.draft.valor ?? 0),
    prazoDias: input.recusada ? null : (input.draft.prazo_dias == null ? null : Number(input.draft.prazo_dias)),
    recusada: input.recusada,
    pendentes: counts.pendentes,
    total: counts.total,
  });

  return input.recusada
    ? "Registrei que você não tem agenda para esta OS. Obrigado!"
    : "Cotação registrada após sua confirmação. Obrigado!";
}

function confirmButtons(body: string) {
  return {
    body,
    buttons: [
      { id: OS_COT_WA_BTN_CONFIRMAR, title: "Sim" },
      { id: OS_COT_WA_BTN_CORRIGIR, title: "Corrigir" },
    ],
  };
}

export async function tryProcessOsParceiroCotacaoWhatsAppInbound(input: {
  sb: SupabaseClient;
  supabaseUrl: string;
  serviceKey: string;
  userId: string;
  fromNumber: string;
  userText: string;
  payload?: Record<string, unknown> | null;
  fromIsOwner: boolean;
  convId?: string;
  messageId?: string;
  media?: MediaExtract[];
  audioMedia?: MediaExtract;
}): Promise<OsParceiroWaResult> {
  const auth = await loadGestaoAuthContext(input.sb, input.userId);
  if (deveIgnorarFluxoParceiro(input.fromNumber, auth, input.fromIsOwner)) {
    return { handled: false };
  }

  const parceiro = await findParceiro(input.sb, input.userId, input.fromNumber);
  if (!parceiro) return { handled: false };

  const abertas = await cotacoesAbertas(input.sb, input.userId, parceiro.id);
  const sessao = await loadSessao(input.sb, input.userId, parceiro.id);
  const buttonId = extractOsCotacaoWaButtonId(input.payload ?? undefined);
  const listId = String(
    (input.payload as { interactive?: { list_reply?: { id?: string } } } | undefined)
      ?.interactive?.list_reply?.id ?? "",
  );
  const interactiveAction = parseOsCotacaoWaInteractiveId(input.userText) ?? (
    buttonId.startsWith("os_cot_wa:") ? buttonId.replace("os_cot_wa:", "") : null
  ) ?? (
    listId.startsWith("os_cot_wa:") ? listId.replace("os_cot_wa:", "") : null
  );

  if (!abertas.length && !sessao) return { handled: false };

  // --- Recusa explícita ---
  if (interactiveAction === "sem_agenda" || buttonId === OS_COT_WA_BTN_SEM_AGENDA) {
    const cot = await resolveCotacaoUnica(input.sb, input.userId, parceiro.id, sessao?.cotacao_id);
    if (!cot) {
      return {
        handled: true,
        reply: "Qual OS? Escolha na lista.",
        interactiveList: await buildPickList(input.sb, input.userId, parceiro.id, abertas),
      };
    }
    const reply = await aplicarConfirmado(input.sb, {
      supabaseUrl: input.supabaseUrl,
      serviceKey: input.serviceKey,
      cotacaoId: cot.id,
      userId: input.userId,
      parceiroNome: parceiro.nome,
      draft: { observacao: "Sem agenda" },
      recusada: true,
      convId: input.convId,
      messageId: input.messageId,
    });
    await clearSessao(input.sb, input.userId, parceiro.id);
    return { handled: true, reply };
  }

  // --- Confirmação ---
  if (interactiveAction === "confirmar_sim" || buttonId === OS_COT_WA_BTN_CONFIRMAR) {
    if (!sessao?.cotacao_id || sessao.fase !== "confirmar") {
      return { handled: true, reply: "Não encontrei cotação pendente de confirmação." };
    }
    const reply = await aplicarConfirmado(input.sb, {
      supabaseUrl: input.supabaseUrl,
      serviceKey: input.serviceKey,
      cotacaoId: sessao.cotacao_id,
      userId: input.userId,
      parceiroNome: parceiro.nome,
      draft: sessao.draft_json,
      convId: input.convId,
      messageId: input.messageId,
    });
    await clearSessao(input.sb, input.userId, parceiro.id);
    return { handled: true, reply };
  }

  if (interactiveAction === "confirmar_corrigir" || buttonId === OS_COT_WA_BTN_CORRIGIR) {
    await saveSessao(input.sb, {
      user_id: input.userId,
      parceiro_id: parceiro.id,
      cotacao_id: sessao?.cotacao_id ?? null,
      fase: "valor",
      draft_json: {},
    });
    return { handled: true, reply: "Sem problemas. Qual o valor do orçamento (R$)?" };
  }

  // --- Início fluxo botão ---
  if (interactiveAction === "enviar_orcamento" || buttonId === OS_COT_WA_BTN_ENVIAR) {
    let cot = await resolveCotacaoUnica(input.sb, input.userId, parceiro.id, sessao?.cotacao_id);
    if (!cot && abertas.length > 1) {
      return {
        handled: true,
        reply: "Você tem mais de uma cotação aberta. Qual destas?",
        interactiveList: await buildPickList(input.sb, input.userId, parceiro.id, abertas),
      };
    }
    if (!cot) cot = abertas[0] ?? null;
    if (!cot) return { handled: true, reply: "Não há cotação aberta para você no momento." };
    await saveSessao(input.sb, {
      user_id: input.userId,
      parceiro_id: parceiro.id,
      cotacao_id: cot.id,
      fase: "valor",
      draft_json: {},
    });
    return { handled: true, reply: "Qual o valor total do orçamento (R$)?" };
  }

  // --- Escolha de OS na lista ---
  const pickMatch = interactiveAction?.match(/^pick_([0-9a-f-]{36})$/i);
  if (pickMatch?.[1]) {
    const cot = abertas.find((c) => c.id === pickMatch[1]);
    if (!cot) return { handled: true, reply: "Cotação inválida ou já encerrada." };
    await saveSessao(input.sb, {
      user_id: input.userId,
      parceiro_id: parceiro.id,
      cotacao_id: cot.id,
      fase: "valor",
      draft_json: {},
    });
    return { handled: true, reply: "Qual o valor total do orçamento (R$)?" };
  }

  // --- Documento / imagem ---
  const doc = input.media?.find((m) => m.kind === "document" || m.kind === "image");
  if (doc?.base64) {
    let cot = await resolveCotacaoUnica(input.sb, input.userId, parceiro.id, sessao?.cotacao_id);
    if (!cot && abertas.length > 1) {
      return {
        handled: true,
        reply: "Qual OS é este orçamento?",
        interactiveList: await buildPickList(input.sb, input.userId, parceiro.id, abertas),
      };
    }
    if (!cot) cot = abertas[0] ?? null;
    if (!cot) return { handled: true, reply: "Não há cotação aberta." };

    const { data: osRow } = await input.sb.from("gestao_os")
      .select("id")
      .eq("id", cot.os_id)
      .maybeSingle();
    if (osRow?.id) {
      await salvarOrcamentoParceiroDocumento(input.sb, {
        userId: input.userId,
        osId: osRow.id,
        media: doc,
      });
    }

    const texto = await textoDeOrcamentoParceiroMedia(doc);
    const parsed = parseOrcamentoFromExtractedText(texto);
    if (parsed.valor == null) {
      return { handled: true, reply: "Recebi o arquivo, mas não achei o valor. Informe: R$ e prazo em dias." };
    }
    await saveSessao(input.sb, {
      user_id: input.userId,
      parceiro_id: parceiro.id,
      cotacao_id: cot.id,
      fase: "confirmar",
      draft_json: {
        valor: parsed.valor,
        prazo_dias: parsed.prazoDias,
        observacao: texto.slice(0, 500),
      },
    });
    return {
      handled: true,
      reply: `Entendi: R$ ${parsed.valor}${parsed.prazoDias ? ` · ${parsed.prazoDias} dias` : ""}. Confirmo?`,
      interactiveButtons: confirmButtons("Confirma este orçamento?"),
    };
  }

  const text = input.userText
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
    .trim();
  if (!text && !sessao) return { handled: false };

  const active = sessao ?? {
    user_id: input.userId,
    parceiro_id: parceiro.id,
    cotacao_id: abertas[0]?.id ?? null,
    fase: "idle",
    draft_json: {},
  } as Sessao;

  if (active.fase === "valor") {
    const parsed = parseOrcamentoParceiroTexto(text);
    if (parsed.valor == null) {
      return { handled: true, reply: "Informe o valor em reais (ex.: 1950 ou R$ 1.950,00)." };
    }
    await saveSessao(input.sb, {
      user_id: input.userId,
      parceiro_id: parceiro.id,
      cotacao_id: active.cotacao_id,
      fase: "prazo",
      draft_json: { ...active.draft_json, valor: parsed.valor },
    });
    return { handled: true, reply: "Qual o prazo em dias?" };
  }

  if (active.fase === "prazo") {
    const prazo = parseOrcamentoParceiroTexto(text).prazoDias ?? Number(text.replace(/\D/g, ""));
    if (!Number.isFinite(prazo) || prazo <= 0) {
      return { handled: true, reply: "Informe o prazo em dias (ex.: 7)." };
    }
    await saveSessao(input.sb, {
      user_id: input.userId,
      parceiro_id: parceiro.id,
      cotacao_id: active.cotacao_id,
      fase: "obs",
      draft_json: { ...active.draft_json, prazo_dias: prazo },
    });
    return { handled: true, reply: "Alguma observação? (opcional — responda *não* para pular)" };
  }

  if (active.fase === "obs") {
    const skip = /^(nao|não|n|skip|-)$/i.test(text);
    const obs = skip ? "" : text;
    await saveSessao(input.sb, {
      user_id: input.userId,
      parceiro_id: parceiro.id,
      cotacao_id: active.cotacao_id,
      fase: "confirmar",
      draft_json: { ...active.draft_json, observacao: obs || active.draft_json.observacao },
    });
    const val = Number(active.draft_json.valor ?? 0);
    const prazo = Number(active.draft_json.prazo_dias ?? 0);
    return {
      handled: true,
      reply: `Confirma R$ ${val} · ${prazo} dias?`,
      interactiveButtons: confirmButtons("Confirma este orçamento?"),
    };
  }

  // Áudio transcrito (one-shot)
  if (input.audioMedia?.base64 && text) {
    let cot = await resolveCotacaoUnica(input.sb, input.userId, parceiro.id, active.cotacao_id);
    if (!cot) cot = abertas[0] ?? null;
    if (cot) {
      const { data: osRow } = await input.sb.from("gestao_os").select("id").eq("id", cot.os_id).maybeSingle();
      if (osRow?.id) {
        await salvarAudioParceiroDocumento(input.sb, {
          userId: input.userId,
          osId: osRow.id,
          media: input.audioMedia,
        });
      }
    }
  }

  // Texto livre one-shot
  const parsed = parseOrcamentoParceiroTexto(text);
  if (parsed.valor != null) {
    let cot = await resolveCotacaoUnica(input.sb, input.userId, parceiro.id, active.cotacao_id);
    if (!cot) cot = abertas[0] ?? null;
    if (!cot) return { handled: true, reply: "Não há cotação aberta." };
    if (parsed.ambiguo || parsed.prazoDias == null) {
      await saveSessao(input.sb, {
        user_id: input.userId,
        parceiro_id: parceiro.id,
        cotacao_id: cot.id,
        fase: parsed.prazoDias == null ? "prazo" : "valor",
        draft_json: { valor: parsed.valor, transcricao: text },
      });
      return {
        handled: true,
        reply: parsed.prazoDias == null
          ? `Valor R$ ${parsed.valor}. Qual o prazo em dias?`
          : "Qual o valor em reais?",
      };
    }
    await saveSessao(input.sb, {
      user_id: input.userId,
      parceiro_id: parceiro.id,
      cotacao_id: cot.id,
      fase: "confirmar",
      draft_json: {
        valor: parsed.valor,
        prazo_dias: parsed.prazoDias,
        transcricao: text.replace(/^🎙️\s*Áudio transcrito:\s*/i, "").trim(),
      },
    });
    return {
      handled: true,
      reply: `Confirma R$ ${parsed.valor} · ${parsed.prazoDias} dias?`,
      interactiveButtons: confirmButtons("Confirma este orçamento?"),
    };
  }

  if (abertas.length) {
    return {
      handled: true,
      reply: "Para responder à cotação, toque em *Enviar orçamento* ou envie valor e prazo (ex.: R$ 1.950, 7 dias).",
    };
  }

  return { handled: false };
}

async function buildPickList(
  sb: SupabaseClient,
  userId: string,
  parceiroId: string,
  abertas: CotacaoRow[],
) {
  const rows = [];
  for (const cot of abertas.slice(0, 10)) {
    const { data: os } = await sb.from("gestao_os").select("numero,veiculo_id").eq("id", cot.os_id).maybeSingle();
    const { data: v } = await sb.from("veiculos_estoque").select("marca,modelo").eq("id", os?.veiculo_id).maybeSingle();
    rows.push({
      id: `os_cot_wa:pick_${cot.id}`,
      title: `OS #${os?.numero ?? "?"}`,
      description: v ? `${v.marca} ${v.modelo}` : "Veículo",
    });
  }
  return {
    body: "Escolha a OS para cotar:",
    button: "Ver OS",
    section_title: "Cotações abertas",
    rows,
  };
}
