// ============================================================================
// AMZ Context — contexto dinâmico do Pietro Eugenio.
// 3 níveis: owner (Felicio), client (cliente AMZ), stranger (bloqueia).
// ============================================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ADMIN_AMZ_USER_ID } from "./agent-soul.ts";

// 21980804901 = número DO AGENTE (Meta Cloud API) — NÃO é o dono
// 21967520706 = número DO DONO (Felicio Carega)
export const OWNER_PHONE = "5521967520706";
export const AGENT_PHONE = "5521980804901";

export type AmzAccess = "owner" | "partner" | "client" | "stranger";

export type AmzContext = {
  access: AmzAccess;
  contact: { phone: string; name?: string | null; email?: string | null } | null;
  block: string;
};


function normalizePhone(p: string): string {
  return (p || "").replace(/\D/g, "");
}

const AMZ_PLATFORM_FAQ = `
BASE DE CONHECIMENTO DA PLATAFORMA AMZ OFERTAS PRO

1) AUTOPILOT DE MARKETING
Publica automaticamente em Instagram/Facebook/TikTok (fuso Sao Paulo).
Cliente conecta as contas em Configurações → Redes Sociais (OAuth Meta).
Posts gerados por IA com imagens, legendas e 6-10 hashtags entre script e CTA.

2) WHATSAPP
Gateway local Baileys (.exe). WuzAPI descontinuado.
Campanhas via RPC 'inserir_campanha_fila' (fila-only). Delays 3-7s.
Cloud API oficial (Meta) para templates.

3) COBRANÇAS E CHECKOUT
Mensalidade AMZ Ofertas Pro: R$ 597/mês.
Cobrança presencial mobile via PIX. Link de pagamento sempre o cadastrado — NUNCA inventar.
Autopilot reativa automaticamente quando cliente em atraso paga.

4) IA E CONTEÚDO
Quota de 50 imagens IA/mês por cliente PJ.
Personas customizadas (campaign_ai_configs). Sanitização remove chat-fluff antes do post.
Geração de carrosséis, Reels, Stories com 3 opções de legenda.

5) MARKETPLACE PÚBLICO
amzofertas.com.br/marketplace — vitrine dos produtos dos clientes.

6) SUPORTE
Felicio Carega: WhatsApp (21) 99537-9550 / (21) 96752-0706.
Painel /painel (senha atom2024suporte — só admins).
`.trim();

export async function buildAmzContext(
  sb: SupabaseClient,
  contactPhone: string,
): Promise<AmzContext> {
  const phone = normalizePhone(contactPhone);

  // OWNER
  if (phone === OWNER_PHONE) {
    const stats = await collectOwnerStats(sb);
    const block = [
      "=== CONTEXTO ESPECIAL — DONO ===",
      "VOCÊ ESTÁ FALANDO COM FELICIO CAREGA, DONO DA AMZ OFERTAS.",
      "",
      "IDENTIDADE COM O DONO: quando falar com Felicio, seu nome é JARVIS.",
      "• Se ele perguntar seu nome, responda 'Jarvis'.",
      "• Nunca se apresente como 'Pietro' pra ele — Pietro é o nome público que você usa com clientes.",
      "• Tom estilo Jarvis do Homem de Ferro: direto, eficiente, levemente irônico quando couber, sempre pronto pra executar. Trate por 'Felicio', 'chefe' ou 'senhor' (esse último com humor jarvisiano, sem formalidade chata).",
      "",
      "Tom: direto, informal, sem enrolação, sem CTA de venda (ele já é o dono).",
      "Ele pode pedir qualquer coisa: consultar clientes, métricas, status,",
      "gerar links pra qualquer cliente, ver cobranças. Você tem acesso total.",
      "Nunca ofereça o telefone dele pra ele mesmo.",
      "",
      "SNAPSHOT DA PLATAFORMA:",
      stats,
      "",
      AMZ_PLATFORM_FAQ,
    ].join("\n");
    return { access: "owner", contact: { phone, name: "Felicio Carega" }, block };
  }

  // PARCEIRO COMERCIAL do dono (contatos_comerciais scoped ao Felicio)
  // Marcelo Martins, Renata, sócios etc — atende como JARVIS, não como Pietro.
  try {
    const tail10 = phone.slice(-10);
    const tail8 = phone.slice(-8);
    const { data: parceiros } = await sb
      .from("contatos_comerciais")
      .select("nome, empresa, cargo, tipo_relacionamento, contexto, proximos_passos, whatsapp")
      .eq("user_id", ADMIN_AMZ_USER_ID)
      .eq("ativo", true);
    const parceiro = (parceiros ?? []).find((c: any) => {
      const cd = normalizePhone(c.whatsapp || "");
      if (!cd) return false;
      return cd === phone || cd.slice(-10) === tail10 || cd.slice(-8) === tail8;
    });
    if (parceiro) {
      const primeiro = (parceiro.nome || "").split(" ")[0] || parceiro.nome || "";
      const block = [
        "=== CONTEXTO ESPECIAL — PARCEIRO COMERCIAL DO FELICIO ===",
        `VOCÊ ESTÁ FALANDO COM ${parceiro.nome?.toUpperCase() ?? "PARCEIRO"} — parceiro/pessoa próxima do Felicio Carega (dono da AMZ).`,
        parceiro.empresa ? `Empresa: ${parceiro.empresa}${parceiro.cargo ? ` — ${parceiro.cargo}` : ""}.` : null,
        parceiro.tipo_relacionamento ? `Relação: ${parceiro.tipo_relacionamento}.` : null,
        parceiro.contexto ? `Sobre ele (uso interno, não recitar): ${parceiro.contexto}` : null,
        parceiro.proximos_passos ? `Próximos passos combinados: ${parceiro.proximos_passos}` : null,
        "",
        "IDENTIDADE COM PARCEIRO: seu nome aqui é JARVIS, assistente pessoal do Felicio.",
        `• Cumprimente pelo primeiro nome ("${primeiro}") com naturalidade — vocês já se conhecem via Felicio.`,
        "• Se perguntarem seu nome, responda 'Jarvis, assistente do Felício'. NUNCA se apresente como 'Pietro' pra ele — Pietro é o nome público que você usa com clientes/leads da AMZ.",
        "• Tom: próximo, direto, cordial, sem discurso de venda, sem CTA de assinatura, sem mandar ele 'procurar o Felicio' (você JÁ é o canal do Felicio).",
        "• Se ele pedir algo do Felicio (recado, agenda, confirmar reunião, status), anote/execute e diga que passa pro chefe. Se for pergunta sobre a plataforma AMZ, responde normalmente com base no FAQ abaixo.",
        "• Se precisar, você pode dizer 'vou avisar o Felicio' — mas não empurre o WhatsApp dele como se ele fosse desconhecido.",
        "",
        AMZ_PLATFORM_FAQ,
      ].filter(Boolean).join("\n");
      return {
        access: "partner",
        contact: { phone, name: parceiro.nome ?? null },
        block,
      };
    }
  } catch (e) {
    console.error("[amz-context] partner lookup:", e);
  }

  // CLIENTE AMZ
  const { data: contact } = await sb
    .from("whatsapp_contacts")
    .select("phone, nome, email")
    .eq("user_id", ADMIN_AMZ_USER_ID)
    .eq("phone", phone)
    .maybeSingle();

  if (contact) {
    const clientCtx = await collectClientContext(sb, phone);
    const block = [
      "=== CONTEXTO DO CLIENTE ===",
      `Cliente ATIVO da AMZ: ${contact.nome ?? "(sem nome cadastrado)"}.`,
      "Trate com atenção e proximidade. Use o nome dele.",
      "Ele já é assinante — foco em ajudar com a plataforma e resolver problemas.",
      "Só empurre upgrade se ele perguntar.",
      "",
      clientCtx,
      "",
      AMZ_PLATFORM_FAQ,
    ].join("\n");
    return { access: "client", contact, block };
  }



  return { access: "stranger", contact: null, block: "" };
}

async function collectOwnerStats(sb: SupabaseClient): Promise<string> {
  const parts: string[] = [];
  try {
    const { count: assinantes } = await sb
      .from("billing_subscriptions").select("id", { count: "exact", head: true })
      .eq("status", "authorized");
    parts.push(`• Assinantes ativos: ${assinantes ?? "?"}`);

    const { count: campanhas } = await sb
      .from("pj_campanhas").select("id", { count: "exact", head: true })
      .eq("ativa", true);
    parts.push(`• Campanhas WhatsApp ativas: ${campanhas ?? 0}`);

    const { count: posts } = await sb
      .from("scheduled_posts").select("id", { count: "exact", head: true })
      .gte("data", new Date().toISOString().slice(0, 10));
    parts.push(`• Posts agendados (hoje/futuro): ${posts ?? 0}`);

    // Clientes com acesso bloqueado à plataforma
    const { data: bloqueados } = await sb
      .from("profiles")
      .select("nome, nome_fantasia, motivo_bloqueio, bloqueado_em")
      .eq("acesso_bloqueado", true)
      .order("bloqueado_em", { ascending: false });

    if (bloqueados && bloqueados.length > 0) {
      parts.push(`• Clientes com acesso BLOQUEADO (${bloqueados.length}):`);
      for (const b of bloqueados) {
        const nome = b.nome_fantasia || b.nome || "(sem nome)";
        parts.push(`   - ${nome}${b.motivo_bloqueio ? ` — ${b.motivo_bloqueio}` : ""}`);
      }
    } else {
      parts.push("• Clientes bloqueados: 0");
    }
  } catch (e) {
    console.error("[amz-context] owner stats:", e);
  }
  return parts.join("\n") || "(sem dados)";
}


async function collectClientContext(sb: SupabaseClient, phone: string): Promise<string> {
  const out: string[] = [];
  try {
    const { data: customer } = await sb
      .from("billing_customers")
      .select("id, name, payment_link")
      .eq("phone", phone).maybeSingle();

    if (customer) {
      const { data: sub } = await sb
        .from("billing_subscriptions")
        .select("status, amount, next_billing_date, payment_fail_count")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      out.push("COBRANÇA:");
      if (sub) {
        out.push(`• Status: ${sub.status ?? "?"}`);
        if (sub.amount) out.push(`• Mensalidade: R$ ${Number(sub.amount).toFixed(2)}`);
        if (sub.next_billing_date) out.push(`• Vencimento: ${sub.next_billing_date}`);
        if ((sub.payment_fail_count ?? 0) > 0) out.push(`• ⚠ Falhas: ${sub.payment_fail_count}`);
      } else {
        out.push("• Sem assinatura ativa.");
      }
      if (customer.payment_link) out.push(`• Link de pagamento cadastrado: ${customer.payment_link}`);
      out.push("");
    }
  } catch (e) {
    console.error("[amz-context] cobrança:", e);
  }

  try {
    const { data: ownContact } = await sb
      .from("whatsapp_contacts").select("user_id")
      .eq("phone", phone).neq("user_id", ADMIN_AMZ_USER_ID).limit(1).maybeSingle();

    if (ownContact?.user_id) {
      const seteDias = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { count: publicados } = await sb
        .from("posts").select("id", { count: "exact", head: true })
        .eq("user_id", ownContact.user_id).gte("created_at", seteDias);
      const { count: agendados } = await sb
        .from("scheduled_posts").select("id", { count: "exact", head: true })
        .eq("user_id", ownContact.user_id).gte("data", new Date().toISOString().slice(0, 10));

      out.push("REDES SOCIAIS (7 dias):");
      out.push(`• Publicados: ${publicados ?? 0}`);
      out.push(`• Agendados: ${agendados ?? 0}`);
    }
  } catch (e) {
    console.error("[amz-context] redes:", e);
  }

  if (out.length === 0) out.push("(sem contexto extra disponível)");
  return out.join("\n");
}

export const STRANGER_MSG =
  "Oi! Sou o Pietro, assistente da AMZ Ofertas Pro 👋\n\n" +
  "Vejo que você ainda não é nosso cliente. Se quiser conhecer a plataforma " +
  "(marketing automatizado + WhatsApp com IA), chama o Felicio direto:\n\n" +
  "📱 wa.me/5521995379550\n\n" +
  "Um abraço!";
