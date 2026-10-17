import { buildNfePreviewResumo, maskCpfCnpj } from "./gestao-nfe-build.ts";
import type { GestaoNfeOperacaoKey } from "./gestao-nfe-config-default.ts";
import { formatGestaoVeiculoLabel, type GestaoVeiculoRow } from "./gestao-veiculo-match.ts";

export function buildNotasMesReply(input: {
  competencia: string;
  total: number;
  autorizadas: number;
}): string {
  if (input.total <= 0) {
    return `Nenhuma NF-e registrada em ${input.competencia}. Veja Gestão → Notas fiscais.`;
  }
  return `${input.total} nota(s) em ${input.competencia} (${input.autorizadas} autorizada(s)). Detalhes no painel Notas fiscais e no pacote do contador.`;
}

export function buildNfeStatusReply(input: {
  veiculoLabel: string;
  status: string;
  numero: number | null;
  serie: number | null;
}): string {
  const num = input.numero != null ? ` nº ${input.numero}` : "";
  const ser = input.serie != null ? ` série ${input.serie}` : "";
  return `NF-e (${input.veiculoLabel}): ${input.status.replace(/_/g, " ")}${num}${ser}. PDF/XML no painel.`;
}

export function buildNfeEmitConfirmMessage(input: {
  preview: string;
}): string {
  return `${input.preview}\n\nResponda SIM para emitir ou NÃO para cancelar.`;
}

export function buildNfeEmitBlockedMessage(missing: string[]): string {
  return `Faltam dados para emitir a nota (${missing.join(", ")}). Complete em Gestão → Configuração fiscal / contrato do carro.`;
}

export function buildNfeEmitSuccessReply(input: {
  status: string;
  veiculoLabel: string;
}): string {
  return `NF-e enviada para ${input.veiculoLabel}. Status: ${input.status.replace(/_/g, " ")}. Acompanhe em Notas fiscais.`;
}

export function nfeTipoLabel(tipo: GestaoNfeOperacaoKey): string {
  if (tipo === "saida_venda") return "saída (venda)";
  if (tipo === "entrada_compra_pf") return "entrada (compra PF)";
  return "consignação";
}

export function buildJarvisNfePreview(
  veiculo: GestaoVeiculoRow,
  input: {
    tipo: GestaoNfeOperacaoKey;
    valor: number;
    tomadorNome: string;
    cfop: string;
    natureza: string;
    ambiente: string;
  },
): string {
  const label = formatGestaoVeiculoLabel(veiculo);
  return buildNfePreviewResumo({
    tipo: input.tipo,
    veiculoLabel: label,
    valor: input.valor,
    tomadorNome: input.tomadorNome,
    cfop: input.cfop,
    natureza: input.natureza,
    ambiente: input.ambiente,
  });
}

export function safeTomadorNomeForLog(nome: string): string {
  const n = nome.trim();
  if (n.length <= 2) return "***";
  return `${n.slice(0, 1)}***`;
}

export function safeDocForLog(doc: string): string {
  return maskCpfCnpj(doc);
}
