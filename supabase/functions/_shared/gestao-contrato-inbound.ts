import type { GestaoContratoTipo } from "./gestao-contrato-template.ts";

export function buildContratosPendentesReply(qtd: number): string {
  if (qtd <= 0) return "Nenhum contrato pendente de assinatura.";
  return `${qtd} contrato(s) aguardando assinatura. Veja Gestão → Contratos.`;
}

export function buildContratoStatusReply(input: {
  veiculoLabel: string;
  status: string;
  signUrl?: string | null;
}): string {
  const st = input.status.replace(/_/g, " ");
  let msg = `Contrato (${input.veiculoLabel}): ${st}.`;
  if (input.signUrl && input.status === "pendente_assinatura") {
    msg += " Link disponível no painel Contratos.";
  }
  return msg;
}

export function parseContratoTipoHint(text: string): GestaoContratoTipo | null {
  if (/\bcompra\b/.test(text)) return "compra";
  if (/\bvenda\b/.test(text)) return "venda";
  if (/\bconsign/.test(text)) return "consignacao";
  if (/\bgarantia\b/.test(text)) return "garantia";
  return null;
}
