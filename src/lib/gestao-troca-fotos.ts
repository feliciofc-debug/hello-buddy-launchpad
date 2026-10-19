export {
  canonicalGestaoTrocaEtiqueta,
  GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR,
  GESTAO_TROCA_FOTO_ETIQUETA_CRLV,
  GESTAO_TROCA_FOTO_ETIQUETAS,
  gestaoTrocaFotoIsCrlv,
  gestaoTrocaFotoPaths,
  normalizeGestaoTrocaFotos,
  type GestaoTrocaFotoEntry,
  type GestaoTrocaFotoSlotOrigem,
} from "../../supabase/functions/_shared/gestao-troca-fotos.ts";

export {
  gestaoTrocaAvisoFotoTrocadaParaRow,
  gestaoTrocaFotoEntryComEtiquetaUsuario,
  gestaoTrocaSlotLabelLoja,
  applyGestaoTrocaIaSlotMergeToFotosJson,
  mergeGestaoTrocaIaSlotsIntoFotos,
} from "../../supabase/functions/_shared/gestao-troca-foto-slot.ts";

export type {
  GestaoTrocaConsolidacaoLaudo,
  GestaoTrocaResumoAreaCondicao,
  GestaoTrocaResumoAreaRow,
} from "../../supabase/functions/_shared/gestao-troca-ia-por-foto-types.ts";
