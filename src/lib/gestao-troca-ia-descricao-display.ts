export {
  GESTAO_TROCA_IA_DESCRICAO_AREA_LABEL,
  gestaoTrocaIaDescricaoIcon,
  parseGestaoTrocaIaDescricaoAreasJson,
  type GestaoTrocaIaDescricaoAreaRow,
  type GestaoTrocaIaDescricaoCondicao,
  type GestaoTrocaIaDescricaoSecao,
} from "../../supabase/functions/_shared/gestao-troca-ia-descricao-schema.ts";

export {
  appendGestaoTrocaLaudoDescricaoPdfLines,
  buildGestaoTrocaLaudoDescricaoPdf,
  type GestaoTrocaLaudoDescricaoPdf,
} from "../../supabase/functions/_shared/gestao-troca-laudo-descricao-display.ts";
