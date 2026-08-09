// ============================================================
// CONTEXTO DO NEGÓCIO DO TENANT (multi-tenant, isolado por user_id)
// Alimenta o gerador de carrossel (e qualquer conteúdo do agente) com
// informação REAL do negócio do cliente, em vez de conteúdo genérico.
//
// Fontes, na ordem: empresa_config (sobre_negocio/diferenciais/publico_alvo/site),
// meta_connections (nome da página / @ do Instagram) e o catálogo de produtos.
// Sem dados → devolve o que houver; NUNCA usa dados de outro tenant.
// ============================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export type TenantBusinessContext = {
  nome: string | null;
  segmento: string | null;
  sobre: string | null;
  diferenciais: string | null;
  publicoAlvo: string | null;
  site: string | null;
  produtos: string[];
  /** telefone de atendimento do tenant (display_phone do whatsapp_config), só dígitos */
  atendimentoTelefone: string | null;
  /** telefone formatado para leitura humana, ex: +55 21 96752-0706 */
  atendimentoTelefoneFmt: string | null;
  /** link wa.me do próprio tenant (nunca fixo/AMZ) */
  atendimentoWaLink: string | null;
  /** true quando o tenant descreveu o negócio (sobre/diferenciais) */
  temContexto: boolean;
  /** bloco pronto para injetar no prompt (vazio quando não há nada) */
  promptBlock: string;
};

function formatBrPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (m) return `+55 ${m[1]} ${m[2]}-${m[3]}`;
  return d ? `+${d}` : "";
}


export async function getTenantBusinessContext(
  sb: SupabaseClient,
  userId: string,
  opts?: { nomeFallback?: string | null; incluirProdutos?: boolean },
): Promise<TenantBusinessContext> {
  let nome = opts?.nomeFallback?.trim() || null;
  let segmento: string | null = null;
  let sobre: string | null = null;
  let diferenciais: string | null = null;
  let publicoAlvo: string | null = null;
  let site: string | null = null;
  let produtos: string[] = [];

  try {
    const { data } = await sb
      .from("empresa_config")
      .select("nome_empresa, segmento, sobre_negocio, diferenciais, publico_alvo, site")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      nome = (data.nome_empresa || "").trim() || nome;
      segmento = (data.segmento || "").trim() || null;
      sobre = (data.sobre_negocio || "").trim() || null;
      diferenciais = (data.diferenciais || "").trim() || null;
      publicoAlvo = (data.publico_alvo || "").trim() || null;
      site = (data.site || "").trim() || null;
    }
  } catch (e) {
    console.warn("[business-context] empresa_config falhou:", (e as Error).message);
  }

  if (opts?.incluirProdutos !== false) {
    try {
      const { data } = await sb
        .from("produtos")
        .select("titulo")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8);
      produtos = (data ?? []).map((p: any) => String(p.titulo || "").trim()).filter(Boolean);
    } catch (e) {
      console.warn("[business-context] produtos falhou:", (e as Error).message);
    }
  }

  const temContexto = !!(sobre || diferenciais);

  const linhas: string[] = [];
  if (nome) linhas.push(`- Nome da marca: ${nome}`);
  if (segmento && segmento !== "outros") linhas.push(`- Segmento: ${segmento}`);
  if (sobre) linhas.push(`- O que o negócio faz: ${sobre}`);
  if (diferenciais) linhas.push(`- Diferenciais / motivos para escolher: ${diferenciais}`);
  if (publicoAlvo) linhas.push(`- Público-alvo: ${publicoAlvo}`);
  if (site) linhas.push(`- Site/link: ${site}`);
  if (produtos.length) linhas.push(`- Produtos/serviços em destaque: ${produtos.slice(0, 8).join("; ")}`);

  const promptBlock = linhas.length
    ? [
        "CONTEXTO REAL DO NEGÓCIO (use SOMENTE estes fatos — é proibido inventar produtos, números, prêmios ou marcas que não estejam aqui):",
        ...linhas,
      ].join("\n")
    : "";

  return { nome, segmento, sobre, diferenciais, publicoAlvo, site, produtos, temContexto, promptBlock };
}

// ============================================================
// PROMPT DO CARROSSEL — MESMA METODOLOGIA DA PLATAFORMA
// Espelha o prompt usado no app (src/components/CarouselGenerator.tsx):
// capa + N content densos (4-5 tópicos por card) + cta, emojis por linha.
// ============================================================
export function buildCarouselPrompt(opts: {
  tema: string;
  numSlides: number;
  business?: TenantBusinessContext | null;
}): string {
  const n = Math.max(3, Math.min(10, opts.numSlides || 7));
  const contentCount = Math.max(n - 2, 1);
  const ctx = opts.business?.promptBlock ? `\n${opts.business.promptBlock}\n` : "";

  return `Você é um diretor criativo e copywriter sênior especialista em carrosséis premium para Instagram.
Crie um carrossel de alto nível, com páginas completas, linguagem forte e benefícios reais — nada genérico, nada vazio.

TEMA BASE DO USUÁRIO:
"""${opts.tema}"""
${ctx}
NÚMERO EXATO DE SLIDES: ${n}

OBJETIVO DO CARROSSEL:
- parecer conteúdo premium, estratégico e profissional
- transformar funcionalidades em benefícios claros
- mostrar valor percebido, resultado prático, ganho de tempo, automação, facilidade, escala ou economia
- preencher bem cada página com informação útil e persuasiva
- usar títulos grandes, impactantes e memoráveis

FORMATO JSON OBRIGATÓRIO:
{
  "slides": [
    { "type": "cover", "title": "headline principal", "body": "subtítulo curto" },
    { "type": "content", "number": 1, "title": "benefício principal", "body": "linha 1\\nlinha 2\\nlinha 3\\nlinha 4", "highlight": "ganho principal" },
    { "type": "cta", "title": "chamada final forte", "body": "frase curta 1\\nfrase curta 2", "ctaLabel": "texto do botão" }
  ],
  "caption": "legenda persuasiva para o post"
}

REGRAS:
- Exatamente 1 cover, ${contentCount} content e 1 cta.
- Português do Brasil.
- Cada slide content deve ter 4 linhas curtas no body (mínimo 4, máximo 5), separadas por \\n — cada linha é um TÓPICO objetivo, nunca uma frase solta.
- A capa deve parecer manchete de campanha premium.
- Legenda com 2 parágrafos + 8-12 hashtags.
- EMOJIS OBRIGATÓRIOS: Coloque um emoji relevante no INÍCIO de cada título (cover, content e cta). Ex: "🚀 5 Motivos para...", "✅ Automatize suas vendas", "🎯 Comece agora".
- Nos bullets do body dos slides content, comece CADA linha com um emoji diferente e relevante ao contexto. Ex: "✅ Publicação automática\\n📊 Relatórios em tempo real\\n🎯 Segmentação inteligente\\n💰 Economia de tempo".
- Use emojis variados e contextuais — evite repetir o mesmo emoji.
${opts.business?.promptBlock ? "- O conteúdo deve falar do negócio descrito no CONTEXTO REAL DO NEGÓCIO. Não invente nome de produto, cliente, número ou prêmio que não esteja lá.\n" : "- Não invente nomes de produtos, números ou prêmios: fale em benefícios verificáveis e genéricos do tema.\n"}- Responda APENAS JSON válido.`;
}
