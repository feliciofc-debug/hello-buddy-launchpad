export {
  buildGestaoTrocaLaudo19Computed,
  isGestaoTrocaLaudo19FotosJson,
  statsItensConfirmadosLaudo,
  type GestaoTrocaLaudo19Computed,
} from "../../supabase/functions/_shared/gestao-troca-laudo-19-computed.ts";

export {
  parseGestaoTrocaAnaliseFotoRows,
  recalcIndicioColisaoGestaoTroca,
} from "../../supabase/functions/_shared/gestao-troca-indicio-recalc.ts";

export {
  calcResultadoLaudo,
  type GestaoTrocaResultadoLaudo,
  type GestaoTrocaResultadoLaudoView,
} from "../../supabase/functions/_shared/gestao-troca-resultado-laudo.ts";

export {
  GESTAO_TROCA_INDICIO_COLISAO_DISCLAIMER,
  type GestaoTrocaIndicioColisaoResult,
} from "../../supabase/functions/_shared/gestao-troca-indicio-colisao.ts";

export {
  gestaoTrocaEspessuraFaixasFromConfig,
  gestaoTrocaEspessuraClassificacaoLabel,
} from "../../supabase/functions/_shared/gestao-troca-espessura.ts";
