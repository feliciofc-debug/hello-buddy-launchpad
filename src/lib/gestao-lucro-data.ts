import { calcGestaoLucro } from "../../supabase/functions/_shared/gestao-lucro-calc.ts";
import { calcularConsignacao } from "../../supabase/functions/_shared/consignacao-calc.ts";
import { daysInStock } from "../../supabase/functions/_shared/gestao-estoque-snapshot.ts";
import { supabase } from "@/integrations/supabase/client";
import type {
  GestaoDespesaRow,
  GestaoLucroBundle,
  GestaoVeiculoEnriched,
} from "./gestao-lucro-types.ts";

export async function loadGestaoLucroBundle(userId: string): Promise<GestaoLucroBundle> {
  const [
    { data: veiculos },
    { data: compras },
    { data: despesas },
    { data: vendas },
    { data: consignacoes },
  ] =
    await Promise.all([
      supabase.from("veiculos_estoque")
        .select(
          "id, marca, modelo, versao, preco, status, placa, fotos, codigo_origem, ano_modelo, ano_fabricacao, combustivel, created_at",
        )
        .eq("user_id", userId),
      supabase.from("veiculo_compra" as "veiculos_estoque")
        .select("veiculo_id, valor_compra, data_compra, origem")
        .eq("user_id", userId),
      supabase.from("veiculo_despesas" as "veiculos_estoque")
        .select(
          "id, veiculo_id, data, categoria, valor, descricao, origem_lancamento, lancado_por, comprovante_path, descontar_do_consignante",
        )
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("data", { ascending: false }),
      supabase.from("veiculo_venda" as "veiculos_estoque")
        .select("veiculo_id, valor_venda, data_venda, vendedor, vendedor_id")
        .eq("user_id", userId),
      supabase.from("veiculo_consignacao" as "veiculos_estoque")
        .select(
          "veiculo_id, consignante_nome, valor_garantido_dono, pct_loja_excedente, piso_loja, preco_minimo_autorizado, data_inicio, prazo_dias, status, observacao",
        )
        .eq("user_id", userId),
    ]);

  const compraBy = new Map(
    (compras ?? []).map((c: {
      veiculo_id: string;
      valor_compra: number;
      data_compra: string;
      origem: "compra" | "troca" | "consignacao";
    }) => [
      c.veiculo_id,
      c,
    ]),
  );
  const consignacaoBy = new Map(
    (consignacoes ?? []).map((c) => [String(c.veiculo_id), c]),
  );
  const vendaBy = new Map(
    (vendas ?? []).map((v: {
      veiculo_id: string;
      valor_venda: number;
      data_venda: string;
      vendedor: string | null;
    }) => [v.veiculo_id, v]),
  );
  const despesasBy = new Map<string, GestaoDespesaRow[]>();
  const despesasFlat: GestaoDespesaRow[] = [];
  for (const d of despesas ?? []) {
    const row = d as GestaoDespesaRow;
    despesasFlat.push(row);
    const list = despesasBy.get(row.veiculo_id) ?? [];
    list.push(row);
    despesasBy.set(row.veiculo_id, list);
  }

  const enriched: GestaoVeiculoEnriched[] = (veiculos ?? []).map((raw) => {
    const v = raw as GestaoVeiculoEnriched & { placa?: string | null };
    const compra = compraBy.get(v.id);
    const venda = vendaBy.get(v.id) as {
      valor_venda: number;
      data_venda: string;
      vendedor: string | null;
      vendedor_id?: string | null;
    } | undefined;
    const dList = despesasBy.get(v.id) ?? [];
    const consignacaoRaw = consignacaoBy.get(v.id) as
      | {
        consignante_nome: string | null;
        valor_garantido_dono: number;
        pct_loja_excedente: number;
        piso_loja: number | null;
        preco_minimo_autorizado: number | null;
        data_inicio: string;
        prazo_dias: number;
        status: "ativo" | "vendido" | "devolvido";
        observacao: string | null;
      }
      | undefined;
    const isConsignado = compra?.origem === "consignacao" && !!consignacaoRaw;
    let lucro = calcGestaoLucro({
      valorCompra: isConsignado ? 0 : compra ? Number(compra.valor_compra) : null,
      despesas: dList.map((x) => ({ valor: Number(x.valor), categoria: x.categoria })),
      valorVenda: venda ? Number(venda.valor_venda) : null,
      precoAnunciado: v.preco,
      dataCompra: compra?.data_compra ?? null,
      dataVenda: venda?.data_venda ?? null,
      statusVeiculo: v.status,
    });
    let consignacaoResultado = null;
    if (isConsignado && consignacaoRaw) {
      const preco = venda ? Number(venda.valor_venda) : Number(v.preco ?? 0);
      const comissao = dList
        .filter((d) => d.categoria === "comissao")
        .reduce((sum, d) => sum + Number(d.valor), 0);
      const calc = calcularConsignacao({
        preco,
        valorGarantidoDono: Number(consignacaoRaw.valor_garantido_dono),
        pctLojaExcedente: Number(consignacaoRaw.pct_loja_excedente),
        pisoLoja: consignacaoRaw.piso_loja == null ? null : Number(consignacaoRaw.piso_loja),
        despesas: dList
          .filter((d) => d.categoria !== "comissao")
          .map((d) => ({
            valor: Number(d.valor),
            descontarDoConsignante: Boolean(d.descontar_do_consignante),
          })),
        comissaoVendedor: comissao,
      });
      consignacaoResultado = calc;
      const custosLoja = calc.despesasNaoDescontaveis + comissao;
      lucro = {
        ...lucro,
        totalDespesas: custosLoja,
        investido: custosLoja,
        lucroBruto: venda ? calc.parteLoja : null,
        lucroLiquido: venda ? calc.lucroLoja : null,
        lucroProjetado: venda ? null : calc.lucroLoja,
        margemPct: preco > 0 ? calc.lucroLoja / preco * 100 : null,
        custoCompraPendente: false,
      };
    }
    return {
      id: v.id,
      marca: v.marca,
      modelo: v.modelo,
      versao: v.versao,
      preco: v.preco,
      status: v.status,
      placa: v.placa ?? null,
      fotos: v.fotos ?? [],
      codigo_origem: v.codigo_origem,
      ano_modelo: v.ano_modelo,
      ano_fabricacao: v.ano_fabricacao,
      combustivel: (v as { combustivel?: string | null }).combustivel ?? null,
      created_at: v.created_at,
      valorCompra: compra ? Number(compra.valor_compra) : null,
      dataCompra: compra?.data_compra ?? null,
      valorVenda: venda ? Number(venda.valor_venda) : null,
      dataVenda: venda?.data_venda ?? null,
      vendedor: venda?.vendedor ?? null,
      vendedor_id: venda?.vendedor_id ?? null,
      despesas: dList,
      lucro,
      compraOrigem: compra?.origem ?? null,
      consignacao: consignacaoRaw
        ? {
          ...consignacaoRaw,
          valor_garantido_dono: Number(consignacaoRaw.valor_garantido_dono),
          pct_loja_excedente: Number(consignacaoRaw.pct_loja_excedente),
          piso_loja: consignacaoRaw.piso_loja == null ? null : Number(consignacaoRaw.piso_loja),
          preco_minimo_autorizado: consignacaoRaw.preco_minimo_autorizado == null
            ? null
            : Number(consignacaoRaw.preco_minimo_autorizado),
        }
        : null,
      consignacaoResultado,
    };
  });

  return { veiculos: enriched, despesasFlat };
}

export function isActiveStock(v: GestaoVeiculoEnriched): boolean {
  return v.status === "disponivel" || v.status === "reservado";
}

export function vehicleLabel(v: GestaoVeiculoEnriched): string {
  return [v.marca, v.modelo, v.versao].filter(Boolean).join(" ");
}

export function vehicleDays(v: GestaoVeiculoEnriched): number {
  return daysInStock(v.dataCompra, v.created_at);
}
