import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { competenciaFromYmdSaoPaulo, hojeSaoPaulo } from "../_shared/gestao-date-br.ts";
import {
  listarPendentesFipeOrdenados,
  selecionarLotePendentesFipe,
  type GiroFipeVeiculoRef,
} from "../_shared/giro-fipe-batch.ts";
import {
  gestaoTrocaAdminClient,
  gestaoTrocaAuthedUser,
  jsonResponse,
  optionsResponse,
  parseFipePriceString,
} from "../_shared/gestao-troca-http.ts";
import {
  buscarMarca,
  consultarPreco,
  listarAnos,
  listarModelos,
  listarModelosPorAno,
  normalizeFipeText,
  rankFipeItems,
  type FipeListItem,
} from "../_shared/fipe.ts";
import { fipeYearAvailabilityDecision } from "../_shared/fipe-routing.ts";

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
}): Promise<
  | { status: "ok"; valor: number; referenciaMes: string; label: string }
  | { status: "not_found"; motivo: string }
> {
  const marca = String(input.marca || "").trim();
  const modelo = String(input.modelo || "").trim();
  const ano = input.anoModelo != null ? String(input.anoModelo) : "";
  if (!marca || !modelo || !ano) {
    return { status: "not_found", motivo: "Marca, modelo ou ano ausente" };
  }
  const brand = await buscarMarca(marca);
  if (!brand) return { status: "not_found", motivo: "Marca FIPE não encontrada" };

  const queryModel = [modelo, input.versao].filter(Boolean).join(" ").trim();
  let candidates = await listarModelosPorAno(brand.code, ano, queryModel);
  if (!candidates.length) {
    candidates = await listarModelos(brand.code, queryModel);
  }
  const model = pickModelSecure(candidates, queryModel);
  if (!model) {
    return { status: "not_found", motivo: "Versão FIPE ambígua ou não encontrada" };
  }

  const years = await listarAnos(brand.code, model.code, ano);
  const yearDecision = fipeYearAvailabilityDecision(years, ano);
  if (yearDecision.action !== "price") {
    return { status: "not_found", motivo: "Ano/modelo FIPE não encontrado com segurança" };
  }

  const price = await consultarPreco({
    brandId: brand.code,
    modelId: model.code,
    yearId: yearDecision.year.code,
  });
  const valor = parseFipePriceString(price.price);
  if (valor == null || valor <= 0) {
    return { status: "not_found", motivo: "Preço FIPE inválido" };
  }
  return {
    status: "ok",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await gestaoTrocaAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(
      DEFAULT_LIMIT,
      Math.max(1, Number(body?.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
    );
    const competenciaAtual = competenciaFromYmdSaoPaulo();
    const skipIds = Array.isArray(body?.skip_ids)
      ? body.skip_ids.map((id: unknown) => String(id))
      : [];
    const sb = gestaoTrocaAdminClient();

    const { data: veiculos, error } = await sb.from("veiculos_estoque")
      .select("id, marca, modelo, versao, ano_modelo, status")
      .eq("user_id", user.id)
      .in("status", ["disponivel", "reservado"]);
    if (error) throw error;

    const refs = await loadRefsFipe(sb, user.id);
    const veiculoIds = (veiculos ?? []).map((v) => String(v.id));
    const { lote: idsLote, pendentesRestantes } = selecionarLotePendentesFipe({
      veiculoIds,
      refs,
      competenciaAtual,
      skipIds,
      limit,
    });
    const veiculoById = new Map(
      (veiculos ?? []).map((v) => [String(v.id), v]),
    );
    const pendentes = idsLote.map((id) => veiculoById.get(id)).filter(Boolean);

    const resultados: Array<{
      veiculo_id: string;
      status: "gravado" | "nao_encontrada";
      valor?: number;
      referencia_mes?: string;
      motivo?: string;
      label?: string;
    }> = [];

    for (const veiculo of pendentes) {
      if (!veiculo) continue;
      const consulta = await consultarFipeVeiculo({
        marca: String(veiculo.marca ?? ""),
        modelo: String(veiculo.modelo ?? ""),
        versao: veiculo.versao == null ? null : String(veiculo.versao),
        anoModelo: veiculo.ano_modelo == null ? null : Number(veiculo.ano_modelo),
      });
      if (consulta.status !== "ok") {
        resultados.push({
          veiculo_id: String(veiculo.id),
          status: "nao_encontrada",
          motivo: consulta.motivo,
        });
        continue;
      }
      const duplicado = await jaExisteFipeMesRef(
        sb,
        user.id,
        String(veiculo.id),
        consulta.referenciaMes,
      );
      if (!duplicado) {
        const { error: insertError } = await sb.from("veiculo_preco_referencia").insert({
          user_id: user.id,
          veiculo_id: veiculo.id,
          fonte: "fipe",
          valor: consulta.valor,
          referencia_mes: consulta.referenciaMes,
        });
        if (insertError) throw insertError;
      }
      resultados.push({
        veiculo_id: String(veiculo.id),
        status: "gravado",
        valor: consulta.valor,
        referencia_mes: consulta.referenciaMes,
        label: consulta.label,
      });
    }

    const pendentesAposSkip = listarPendentesFipeOrdenados(
      veiculoIds,
      refs,
      competenciaAtual,
      skipIds,
    ).length;

    return jsonResponse({
      success: true,
      competencia_atual: competenciaAtual,
      processados: resultados.length,
      gravados: resultados.filter((r) => r.status === "gravado").length,
      nao_encontrados: resultados.filter((r) => r.status === "nao_encontrada").length,
      pendentes_restantes: pendentesRestantes,
      pendentes_total: pendentesAposSkip,
      resultados,
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
