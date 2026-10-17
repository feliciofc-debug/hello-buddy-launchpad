/** Preços exibidos nos cards de integração — atualize aqui quando o fornecedor mudar valores. */

export const VENDOR_PRICING_CONSULTED_LABEL = "out/2026";

export const VENDOR_PRICING_DISCLAIMER =
  `Valores do fornecedor consultados em ${VENDOR_PRICING_CONSULTED_LABEL} — podem mudar. O pagamento é feito direto ao fornecedor.`;

export type VendorPricingEntry = {
  id: string;
  name: string;
  description: string;
  priceSummary: string;
  priceDetail?: string;
  officialPricingUrl: string;
  signupUrl: string;
};

export const VENDOR_INTEGRATION_PRICING: Record<string, VendorPricingEntry> = {
  zapsign: {
    id: "zapsign",
    name: "ZapSign",
    description: "Assinatura digital de contratos de venda e documentos da loja (API).",
    priceSummary:
      "Plano API a partir de US$ 39/mês (≈ R$ 210) com 80 documentos/mês; documento extra US$ 0,60.",
    priceDetail: "Ambiente de teste gratuito.",
    officialPricingUrl: "https://zapsign.co/pricing",
    signupUrl: "https://zapsign.co/",
  },
  focusnfe: {
    id: "focusnfe",
    name: "Focus NFe",
    description: "Emissão de notas fiscais eletrônicas (NF-e) — integração prevista em breve.",
    priceSummary: "A partir de R$ 119,90/mês (até 3 CNPJs).",
    priceDetail: "Ambiente de homologação gratuito.",
    officialPricingUrl: "https://focusnfe.com.br/precos/",
    signupUrl: "https://focusnfe.com.br/",
  },
};
