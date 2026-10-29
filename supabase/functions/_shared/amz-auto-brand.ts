import { AMZ_TENANT_ID } from "./amz-tenant.ts";
import type { CarouselColor } from "./carousel-colors.ts";
import type { TenantBusinessContext } from "./business-context.ts";

export const AMZ_AUTO_BRAND_NAME = "AMZ Auto";

export const AMZ_AUTO_AUDIENCE =
  "donos, gerentes e vendedores de lojas de veículos e concessionárias";

/** Mesma paleta da AMZ Ofertas para carrossel (laranja + destaque escuro no template). */
export const AMZ_AUTO_CAROUSEL_COLOR: CarouselColor = {
  slug: "amz-auto",
  label: "Cor da marca",
  emoji: "🎨",
  primaryColor: "#FF6A13",
  secondaryColor: "#FF6A13",
};

export const AMZ_AUTO_FICHA_ITEMS: readonly string[] = [
  "Atendimento 24h no WhatsApp: o Jarvis atende os clientes, mostra os carros com fotos e passa ao vendedor.",
  "Marketing: artes, anúncios e carrosséis a partir da foto do carro, com legenda.",
  "Postagem por comando: do WhatsApp direto para Instagram, Facebook e TikTok, na hora ou agendado.",
  "Estoque e portais: vitrine para os clientes e publicação na Webmotors, OLX e Mercado Livre.",
  "Giro 30/60/90: alerta de carro parado no estoque aos 30, 60 e 90 dias.",
  "Consulta por placa: preços Molicar e procedência (débitos, gravame e Renajud).",
  "Documentos: CRLV e documentos em cofre criptografado, com leitura automática.",
  "Vistoria e troca: laudo de vistoria com fotos e avaliação do carro na troca.",
  "OS e cotações: ordens de serviço e cotações com prestadores de serviço pelo WhatsApp.",
  "Relatórios no WhatsApp: resumo do dia e desempenho dos vendedores.",
  "Painel de gestão: tudo acompanhado em amzofertas.com.br.",
  "Integração com o sistema de gestão da loja.",
] as const;

export function amzAutoLogoStoragePath(amzTenantId: string = AMZ_TENANT_ID): string {
  return `${amzTenantId}/amz-auto-logo.png`;
}

export function normalizeCarouselRequestText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Detecta menção à marca AMZ Auto no pedido (amz auto, amzauto, Amz-Auto, etc.). */
export function mentionsAmzAutoInCarouselRequest(text: string): boolean {
  const compact = normalizeCarouselRequestText(text).replace(/\s+/g, "");
  if (compact.includes("amzauto")) return true;
  const spaced = normalizeCarouselRequestText(text);
  return /\bamz auto\b/.test(spaced);
}

export function shouldUseAmzAutoCarouselBrand(
  userId: string,
  requestText: string,
): boolean {
  return userId === AMZ_TENANT_ID &&
    mentionsAmzAutoInCarouselRequest(requestText);
}

function fichaBlock(): string {
  const lines = AMZ_AUTO_FICHA_ITEMS.map((item, i) => `${i + 1}. ${item}`);
  return [
    "FICHA OFICIAL DA PLATAFORMA AMZ AUTO (fonte única — use SOMENTE estes fatos; é proibido inventar recurso, número, preço, cliente, case ou integração que não esteja aqui):",
    `Marca: ${AMZ_AUTO_BRAND_NAME}`,
    `Público-alvo: ${AMZ_AUTO_AUDIENCE}`,
    "",
    ...lines,
  ].join("\n");
}

export function buildAmzAutoCarouselCopyPromptBlock(): string {
  return [
    "=== CARROSSEL AMZ AUTO — VOZ E LEGENDA ===",
    `- Fale com ${AMZ_AUTO_AUDIENCE}.`,
    `- A marca é ${AMZ_AUTO_BRAND_NAME} (plataforma completa para lojas de veículos).`,
    "- Não invente preço, promoção, número de clientes, depoimento ou funcionalidade.",
    "- Legenda persuasiva com chamada para contato (WhatsApp/demo), coerente com os slides.",
    fichaBlock(),
  ].join("\n");
}

export function buildAmzAutoCarouselBrandContextForCaptions(): string {
  return [
    `Marca: ${AMZ_AUTO_BRAND_NAME}. Público: ${AMZ_AUTO_AUDIENCE}.`,
    "Legendas A/B/C para Instagram sobre a plataforma completa — benefícios reais da ficha, sem inventar.",
    "CTA: agendar demonstração ou falar no WhatsApp. Não cite produto físico nem estoque de loja.",
    fichaBlock(),
  ].join("\n");
}

function ctaBlockFromBusiness(business?: TenantBusinessContext | null): string {
  const tel = business?.atendimentoTelefoneFmt || null;
  const waLink = business?.atendimentoWaLink || null;
  if (tel && waLink) {
    return `\nCTA DE ATENDIMENTO (OBRIGATÓRIO):
- No slide "cta", convide lojistas/concessionárias a falar no WhatsApp e mostre o número ${tel} numa linha do body.
- Na "caption", inclua exatamente esta linha antes das hashtags: "Fale com a gente no WhatsApp 👉 ${waLink}".
- É proibido usar qualquer outro número, link ou canal de contato que não seja esse.\n`;
  }
  return `\nCTA DE ATENDIMENTO:
- No slide "cta", convide a loja a chamar no WhatsApp de forma genérica, SEM número e SEM link inventado.
- É proibido inventar telefone, link ou canal de contato.\n`;
}

export function buildAmzAutoCarouselPrompt(opts: {
  tema: string;
  numSlides: number;
  business?: TenantBusinessContext | null;
}): string {
  const n = Math.max(3, Math.min(10, opts.numSlides || 7));
  const contentCount = Math.max(n - 2, 1);
  const ctx = opts.business?.promptBlock ? `\n${opts.business.promptBlock}\n` : "";

  return `Você é um diretor criativo e copywriter sênior especialista em carrosséis premium para Instagram.
Crie um carrossel de alto nível para a marca ${AMZ_AUTO_BRAND_NAME}, direcionado a ${AMZ_AUTO_AUDIENCE}.

TEMA BASE DO USUÁRIO:
"""${opts.tema}"""

${fichaBlock()}
${ctx}${ctaBlockFromBusiness(opts.business)}
NÚMERO EXATO DE SLIDES: ${n}

OBJETIVO DO CARROSSEL:
- Apresentar a plataforma ${AMZ_AUTO_BRAND_NAME} de forma premium e estratégica
- Cobrir TODAS as 12 ferramentas da ficha (agrupando 2 ferramentas por slide content quando necessário para caber em ${contentCount} slides de conteúdo)
- Capa: ${AMZ_AUTO_BRAND_NAME} + promessa clara para lojistas/concessionárias
- Fechamento (cta): chamada para contato / demonstração
- Nada genérico; só benefícios derivados da ficha

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
- Cada slide content deve ter 4 linhas curtas no body (mínimo 4, máximo 5), separadas por \\n.
- É PROIBIDO usar emojis nos títulos e no body dos slides.
- Nome da marca nos textos: ${AMZ_AUTO_BRAND_NAME}. Nunca escreva "AMZ Ofertas" neste carrossel.
- Não invente recurso, número, preço ou cliente.
- Responda APENAS JSON válido.`;
}

export type AmzAutoCarouselRenderOptions = {
  businessName: string;
  logo_path: string;
  brand_mark_text: string;
  skip_tenant_logo_fallback: true;
};

export function resolveAmzAutoCarouselRenderOptions(
  amzTenantId: string = AMZ_TENANT_ID,
): AmzAutoCarouselRenderOptions {
  return {
    businessName: AMZ_AUTO_BRAND_NAME,
    logo_path: amzAutoLogoStoragePath(amzTenantId),
    brand_mark_text: AMZ_AUTO_BRAND_NAME,
    skip_tenant_logo_fallback: true,
  };
}
