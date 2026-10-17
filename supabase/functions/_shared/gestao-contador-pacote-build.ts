import { calcDreMes, type GestaoOperacionalDreLine, type GestaoVendaDreLine } from "./gestao-dre-calc.ts";
import { GESTAO_CONTADOR_AVISO } from "./gestao-contador-token.ts";
import { gestaoOperacionalCategoriaLabel } from "./gestao-operacional-categorias.ts";

export type GestaoContadorPacote = {
  aviso: string;
  competencia: string;
  nomeEmpresa: string;
  dre: ReturnType<typeof calcDreMes>;
  vendas: GestaoVendaDreLine[];
  operacionais: GestaoOperacionalDreLine[];
  contas: Array<{
    tipo: string;
    categoria: string;
    categoriaLabel: string;
    valor: number;
    vencimento: string;
    liquidadoEm: string | null;
    observacao: string | null;
  }>;
  comissoesBonus: Array<{ descricao: string; valor: number }>;
  notasFiscais: Array<{
    id: string;
    tipo_operacao: string;
    status: string;
    numero: number | null;
    serie: number | null;
    valor_total: number | null;
    authorized_at: string | null;
    created_at: string;
    xml_url: string | null;
    danfe_url: string | null;
  }>;
};

export function buildGestaoContadorPacote(input: {
  competencia: string;
  nomeEmpresa: string;
  vendas: GestaoVendaDreLine[];
  operacionais: GestaoOperacionalDreLine[];
  contas: GestaoContadorPacote["contas"];
  comissoesBonus: GestaoContadorPacote["comissoesBonus"];
  notasFiscais?: GestaoContadorPacote["notasFiscais"];
}): GestaoContadorPacote {
  const dre = calcDreMes(input.competencia, input.vendas, input.operacionais);
  return {
    aviso: GESTAO_CONTADOR_AVISO,
    competencia: input.competencia,
    nomeEmpresa: input.nomeEmpresa,
    dre,
    vendas: input.vendas.filter((v) => v.dataVenda.startsWith(input.competencia)),
    operacionais: input.operacionais.filter((o) =>
      (o.pagoEm ?? o.vencimento).startsWith(input.competencia)
    ),
    contas: input.contas.map((c) => ({
      ...c,
      categoriaLabel: gestaoOperacionalCategoriaLabel(c.categoria),
    })),
    comissoesBonus: input.comissoesBonus,
    notasFiscais: (input.notasFiscais ?? []).filter((n) => {
      const ref = n.authorized_at ?? n.created_at;
      return ref.startsWith(input.competencia);
    }),
  };
}
