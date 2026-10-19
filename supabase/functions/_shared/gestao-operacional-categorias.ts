export const GESTAO_CATEGORIAS_PAGAR = [
  "aluguel",
  "folha_salarios",
  "pro_labore",
  "energia",
  "agua",
  "internet_telefone",
  "marketing",
  "sistemas",
  "contador",
  "impostos",
  "manutencao_loja",
  "bonus_vendedores",
  "tarifas_bancarias",
  "outros",
] as const;

export const GESTAO_CATEGORIAS_RECEBER = [
  "financiamento_receber",
  "venda_prazo",
  "outros_recebimento",
] as const;

export type GestaoCategoriaOperacional =
  | (typeof GESTAO_CATEGORIAS_PAGAR)[number]
  | (typeof GESTAO_CATEGORIAS_RECEBER)[number];

const LABELS: Record<string, string> = {
  aluguel: "Aluguel",
  folha_salarios: "Folha / salários",
  pro_labore: "Pró-labore",
  energia: "Energia",
  agua: "Água",
  internet_telefone: "Internet / telefone",
  marketing: "Marketing",
  sistemas: "Sistemas",
  contador: "Contador",
  impostos: "Impostos",
  manutencao_loja: "Manutenção da loja",
  bonus_vendedores: "Bônus de vendedores",
  tarifas_bancarias: "Tarifas bancárias",
  financiamento_receber: "Financiamento a receber",
  venda_prazo: "Venda a prazo",
  outros_recebimento: "Outros recebimentos",
  outros: "Outros",
};

export function gestaoOperacionalCategoriaLabel(cat: string): string {
  return LABELS[cat] ?? cat;
}
