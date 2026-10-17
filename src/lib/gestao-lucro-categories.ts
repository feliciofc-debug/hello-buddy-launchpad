export const GESTAO_DESPESA_CATEGORIAS = [
  { value: "mecanica", label: "Mecânica" },
  { value: "funilaria_pintura", label: "Funilaria / pintura" },
  { value: "pneus", label: "Pneus" },
  { value: "estetica", label: "Estética" },
  { value: "documentacao", label: "Documentação" },
  { value: "transporte", label: "Transporte" },
  { value: "anuncio", label: "Anúncio" },
  { value: "comissao", label: "Comissão" },
  { value: "outros", label: "Outros" },
] as const;

export type GestaoDespesaCategoria = (typeof GESTAO_DESPESA_CATEGORIAS)[number]["value"];

export function gestaoCategoriaLabel(value: string): string {
  return GESTAO_DESPESA_CATEGORIAS.find((c) => c.value === value)?.label ?? value;
}
