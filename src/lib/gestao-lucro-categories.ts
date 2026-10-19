import { gestaoDespesaCategoriaLabel } from "../../supabase/functions/_shared/gestao-categoria-pt.ts";

export const GESTAO_DESPESA_CATEGORIAS = [
  { value: "mecanica", label: "Mecânica" },
  { value: "funilaria_pintura", label: "Funilaria e pintura" },
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
  return gestaoDespesaCategoriaLabel(value);
}
