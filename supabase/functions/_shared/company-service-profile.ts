export const PREMIUM_VEHICLE_RETAIL_SEGMENT = "revenda-veiculos-premium";

export const PREMIUM_VEHICLE_RETAIL_PROFILE = {
  name: "Revenda de veículos premium",
  segmentName: "Revenda de automóveis",
  audience: "Clientes de altíssimo padrão e classe média alta",
  tone:
    "Consultor de alto padrão: elegante, discreto, cordial e preciso. Trata por você com polidez, sem gírias, com mensagens curtas e bem escritas.",
  vocabulary: [
    "procedência",
    "único dono",
    "revisões em concessionária",
    "laudo cautelar",
    "vistoria",
    "blindagem",
    "nível e certificado",
    "km",
    "ano/modelo",
    "financiamento",
    "avaliação do seu veículo na troca",
    "atendimento exclusivo",
    "agendamento de visita",
    "test drive",
    "entrega",
  ],
  customerExample: "Bom dia, a Defender ainda está disponível?",
  assistantExample:
    "Bom dia! Está disponível, sim. É 2024/2025, com procedência verificada e laudo cautelar. Posso agendar uma visita exclusiva para você conhecê-la ou enviar mais fotos e as condições de financiamento?",
} as const;

const VEHICLE_TERMS =
  /\b(ve[íi]culos?|carros?|autom[óo]veis?|seminovos?|zero\s*km|suvs?|picapes?|4x4|concession[áa]ria)\b/i;
const VEHICLE_RETAIL_TERMS =
  /\b(compra|compramos|venda|vendemos|revenda|estoque|multimarcas|troca|financiamento|loja\s+de\s+ve[íi]culos?)\b/i;
const PARTS_RETAIL_TERMS =
  /\b(autope[çc]as?|pe[çc]as?|acess[óo]rios?|oficina|mec[âa]nica|instala[çc][ãa]o|compat[íi]vel)\b/i;
const EXPLICIT_VEHICLE_RETAIL_TERMS =
  /\b(compra\s+e\s+venda|compramos?\s+(?:seu\s+)?(?:carro|ve[íi]culo)|vendemos?\s+(?:carros?|ve[íi]culos?)|revenda\s+(?:premium\s+)?(?:de\s+)?(?:carros?|ve[íi]culos?|autom[óo]veis?)|concession[áa]ria|multimarcas|loja\s+de\s+ve[íi]culos?|estoque\s+de\s+(?:carros?|ve[íi]culos?)|seminovos?)\b/i;

export function isPremiumVehicleRetailBusiness(
  businessText: string,
): boolean {
  const text = String(businessText || "");
  if (!VEHICLE_TERMS.test(text) || !VEHICLE_RETAIL_TERMS.test(text)) {
    return false;
  }
  return !PARTS_RETAIL_TERMS.test(text) ||
    EXPLICIT_VEHICLE_RETAIL_TERMS.test(text);
}

export function suggestCompanyServiceProfile(
  selectedSegment: string,
  businessText: string,
): string {
  if (selectedSegment === PREMIUM_VEHICLE_RETAIL_SEGMENT) {
    return selectedSegment;
  }
  return selectedSegment === "automotivo" &&
      isPremiumVehicleRetailBusiness(businessText)
    ? PREMIUM_VEHICLE_RETAIL_SEGMENT
    : selectedSegment;
}

export function companyServiceProfilePrompt(
  selectedSegment: string,
  businessText = "",
): string | null {
  const effectiveSegment = suggestCompanyServiceProfile(
    selectedSegment,
    businessText,
  );
  if (effectiveSegment !== PREMIUM_VEHICLE_RETAIL_SEGMENT) return null;

  return `PERFIL DE ATENDIMENTO — ${PREMIUM_VEHICLE_RETAIL_PROFILE.name}:
- Público: ${PREMIUM_VEHICLE_RETAIL_PROFILE.audience}.
- Estilo: ${PREMIUM_VEHICLE_RETAIL_PROFILE.tone}
- Use "você" com polidez. Nunca use gírias nem saudações como "Fala!".
- Escreva mensagens curtas e bem redigidas. Use no máximo 1 emoji e somente quando fizer sentido.
- Vocabulário apropriado: ${PREMIUM_VEHICLE_RETAIL_PROFILE.vocabulary.join(", ")}.
- NUNCA invente preço, quilometragem, blindagem, disponibilidade ou qualquer dado do veículo.
- Informe somente fatos presentes no estoque cadastrado. Se um dado não estiver disponível, diga que vai confirmar com o consultor e encaminhe o atendimento.
- Nunca pressione e nunca use urgência artificial, inclusive "últimas unidades" ou "corre".
- Conduza com discrição para atendimento exclusivo, envio de informações, avaliação de troca, agendamento de visita ou test drive, conforme o interesse do cliente.
- Exemplo de referência:
  Cliente: "${PREMIUM_VEHICLE_RETAIL_PROFILE.customerExample}"
  IA: "${PREMIUM_VEHICLE_RETAIL_PROFILE.assistantExample}"`;
}
