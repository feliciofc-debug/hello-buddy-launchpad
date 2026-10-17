import { gestaoOperacionalCategoriaLabel } from "./gestao-operacional-categorias.ts";

const HINTS: Record<string, string[]> = {
  aluguel: ["alug", "locac"],
  folha_salarios: ["folha", "salari", "holerite"],
  pro_labore: ["pro labore", "pro-labore", "prolabore"],
  energia: ["energ", "luz", "cemig", "enel", "cpfl", "light"],
  agua: ["agua", "água", "sabesp", "copasa"],
  internet_telefone: ["internet", "telefone", "vivo", "claro", "tim", "oi "],
  marketing: ["marketing", "meta ads", "google ads", "trafego"],
  sistemas: ["sistema", "software", "saas", "assinatura"],
  contador: ["contador", "contabil"],
  impostos: ["imposto", "darf", "gps", "inss", "simples"],
  manutencao_loja: ["manutenc", "predial"],
  bonus_vendedores: ["bonus", "bônus", "comiss"],
  financiamento_receber: ["financ", "parcela"],
  venda_prazo: ["venda", "receb"],
  outros_recebimento: ["receb"],
  outros: [],
};

export function categoriaCompativelComExtrato(descricaoExtrato: string, categoria?: string): boolean {
  if (!categoria) return false;
  const d = descricaoExtrato.toLowerCase();
  const hints = HINTS[categoria] ?? [];
  if (hints.some((h) => d.includes(h))) return true;
  const label = gestaoOperacionalCategoriaLabel(categoria).toLowerCase();
  if (label.length > 3 && d.includes(label.split(" ")[0]!)) return true;
  return false;
}
