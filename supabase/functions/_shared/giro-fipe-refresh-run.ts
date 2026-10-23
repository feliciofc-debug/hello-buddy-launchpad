import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { competenciaFromYmdSaoPaulo, hojeSaoPaulo } from "./gestao-date-br.ts";
import { parseFipePriceString } from "./gestao-troca-http.ts";
import {
  listarPendentesFipeOrdenados,
  selecionarLotePendentesFipe,
  type GiroFipeVeiculoRef,
} from "./giro-fipe-batch.ts";
import {
  buscarMarca,
  consultarPreco,
  listarAnos,
  listarModelos,
  listarModelosPorAno,
  normalizeFipeText,
  rankFipeItems,
  type FipeListItem,
} from "./fipe.ts";
import { fipeYearAvailabilityDecision } from "./fipe-routing.ts";

const DEFAULT_LIMIT = 20;

function referenciaMesFromFipe(referenceMonth: string, fallbackYmd: string): string {
  const months: Record<string, string> = {
    janeiro: "01",
    fevereiro: "02",
    marco: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };
  const normalized = String(referenceMonth || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const match = normalized.match(
    /(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/,
  );
  if (match) return `${match[2]}-${months[match[1]]}`;
  return competenciaFromYmdSaoPaulo(new Date(`${fallbackYmd}T12:00:00Z`));
}

function pickModelSecure(models: FipeListItem[], query: string): FipeListItem | null {
  const ranked = rankFipeItems(models, query);
  if (!ranked.length) return null;
  if (ranked.length === 1) return ranked[0];
  const q = normalizeFipeText(query);
  const top = ranked[0];
  const second = ranked[1];
  const topNorm = normalizeFipeText(top.name);
  const secondNorm = normalizeFipeText(second.name);
  if (topNorm === q) return top;
  if (topNorm.includes(q) && !secondNorm.includes(q)) return top;
  if (q.includes(topNorm) && !q.includes(secondNorm)) return top;
  return null;
}

async function consultarFipeVeiculo(input: {
  marca: string;
  modelo: string;
  versao: string | null;
  anoModelo: number | null;
}) {
  const marca = String(input.marca || "").trim();
  const modelo = String(input.modelo || "").trim();
  const ano = input.anoModelo != null ? String(input.anoModelo) : "";
  if (!marca || !modelo || !ano) {
    return { status: "not_found" as const, motivo: "Marca, modelo ou ano ausente" };
  }
  const brand = await buscarMarca(marca);
  if (!brand) return { status: "not_found" as const, motivo: "Marca FIPE não encontrada" };

  const queryModel = [modelo, input.versao].filter(Boolean).join(" ").trim();
  let candidates = await listarModelosPorAno(brand.code, ano, queryModel);
  if (!candidates.length) candidates = await listarModelos(brand.code, queryModel);
  const model = pickModelSecure(candidates, queryModel);
  if (!model) {
    return { status: "not_found" as const, motivo: "Versão FIPE ambígua ou não encontrada" };
  }

  const years = await listarAnos(brand.code, model.code, ano);
  const yearDecision = fipeYearAvailabilityDecision(years, ano);
  if (yearDecision.action !== "price") {
    return { status: "not_found" as const, motivo: "Ano/modelo FIPE não encontrado com segurança" };
  }

  const price = await consultarPreco({
    brandId: brand.code,
    modelId: model.code,
    yearId: yearDecision.year.code,
  });
  const valor = parseFipePriceString(price.price);
  if (valor == null || valor <= 0) {
    return { status: "not_found" as const, motivo: "Preço FIPE inválido" };
  }
  return {
    status: "ok" as const,
    valor,
    referenciaMes: referenciaMesFromFipe(price.referenceMonth, hojeSaoPaulo()),
    label: `${price.brand} ${price.model}`,
  };
}

async function loadRefsFipe(sb: SupabaseClient, userId: string): Promise<GiroFipeVeiculoRef[]> {
  const { data, error } = await sb.from("veiculo_preco_referencia")
    .select("veiculo_id, fonte, capturado_em, referencia_mes")
    .eq("user_id", userId)
    .eq("fonte", "fipe");
  if (error) throw error;
  return (data ?? []) as GiroFipeVeiculoRef[];
}

async function jaExisteFipeMesRef(
  sb: SupabaseClient,
  userId: string,
  veiculoId: string,
  referenciaMes: string,
): Promise<boolean> {
  const { data, error } = await sb.from("veiculo_preco_referencia")
    .select("id")
    .eq("user_id", userId)
    .eq("veiculo_id", veiculoId)
    .eq("fonte", "fipe")
    .eq("referencia_mes", referenciaMes)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function runGiroFipeRefreshBatch(
  sb: SupabaseClient,
  userId: string,
  options: { limit?: number; skipIds?: string[] } = {},
): Promise<{
  processados: number;
  gravados: number;
  nao_encontrados: number;
  pendentes_restantes: number;
  falhas_ids: string[];
}> {
  const limit = Math.min(DEFAULT_LIMIT, Math.max(1, options.limit ?? DEFAULT_LIMIT));
  const competenciaAtual = competenciaFromYmdSaoPaulo();
  const skipIds = options.skipIds ?? [];

  const { data: veiculos, error } = await sb.from("veiculos_estoque")
    .select("id, marca, modelo, versao, ano_modelo, status")
    .eq("user_id", userId)
    .in("status", ["disponivel", "reservado"]);
  if (error) throw error;

  let refs = await loadRefsFipe(sb, userId);
  const veiculoIds = (veiculos ?? []).map((v) => String(v.id));
  const { lote: idsLote, pendentesRestantes } = selecionarLotePendentesFipe({
    veiculoIds,
    refs,
    competenciaAtual,
    skipIds,
    limit,
  });
  const veiculoById = new Map((veiculos ?? []).map((v) => [String(v.id), v]));

  let gravados = 0;
  let naoEncontrados = 0;
  const falhas_ids: string[] = [];

  for (const id of idsLote) {
    const veiculo = veiculoById.get(id);
    if (!veiculo) continue;
    const consulta = await consultarFipeVeiculo({
      marca: String(veiculo.marca ?? ""),
      modelo: String(veiculo.modelo ?? ""),
      versao: veiculo.versao == null ? null : String(veiculo.versao),
      anoModelo: veiculo.ano_modelo == null ? null : Number(veiculo.ano_modelo),
    });
    if (consulta.status !== "ok") {
      naoEncontrados += 1;
      falhas_ids.push(String(veiculo.id));
      continue;
    }
    const duplicado = await jaExisteFipeMesRef(sb, userId, String(veiculo.id), consulta.referenciaMes);
    if (!duplicado) {
      const { error: insertError } = await sb.from("veiculo_preco_referencia").insert({
        user_id: userId,
        veiculo_id: veiculo.id,
        fonte: "fipe",
        valor: consulta.valor,
        referencia_mes: consulta.referenciaMes,
      });
      if (insertError) throw insertError;
      refs = [
        ...refs,
        {
          veiculo_id: String(veiculo.id),
          fonte: "fipe",
          capturado_em: new Date().toISOString(),
          referencia_mes: consulta.referenciaMes,
        },
      ];
    }
    gravados += 1;
  }

  return {
    processados: idsLote.length,
    gravados,
    nao_encontrados: naoEncontrados,
    pendentes_restantes: pendentesRestantes,
    falhas_ids,
  };
}

/** Atualização FIPE mensal automática (lotes de 20, skip de falhas). */
export async function runGiroFipeAutoMes(
  sb: SupabaseClient,
  userId: string,
  maxRodadas = 8,
): Promise<{ rodadas: number; gravados: number; tentados: number }> {
  const skipIds: string[] = [];
  let rodadas = 0;
  let gravados = 0;
  let tentados = 0;
  while (rodadas < maxRodadas) {
    const batch = await runGiroFipeRefreshBatch(sb, userId, { skipIds });
    rodadas += 1;
    gravados += batch.gravados;
    tentados += batch.processados;
    for (const id of batch.falhas_ids) {
      if (!skipIds.includes(id)) skipIds.push(id);
    }
    if (batch.processados === 0) break;
  }
  return { rodadas, gravados, tentados };
}
