import {
  calcTrocaPreco,
  DEFAULT_GESTAO_TROCA_CONFIG,
  type GestaoTrocaConfigCalc,
} from "../_shared/calc-troca-preco.ts";
import type { ProcedenciaResumoJson } from "../_shared/consultar-placa-parse.ts";
import {
  buscarMarca,
  consultarPreco,
  listarAnos,
  listarModelos,
} from "../_shared/fipe.ts";
import {
  assertGestaoTrocaTransicao,
  type GestaoTrocaAcao,
} from "../_shared/gestao-troca-status.ts";
import {
  listGestaoTrocaIaCustos,
  saveGestaoTrocaIaCustos,
} from "../_shared/gestao-troca-ia-custos.ts";
import {
  assertPodeSolicitarAprovacaoTroca,
  confirmarKmPainelGestaoTroca,
  decidirItemIaGestaoTroca,
  iniciarGestaoTrocaIaAnalise,
  statusAnaliseGestaoTroca,
} from "../_shared/gestao-troca-ia-ops.ts";
import type { GestaoTrocaIaCustoRow } from "../_shared/gestao-troca-ia-rules.ts";
import {
  finalizarLaudoGestaoTroca,
  reabrirLaudoGestaoTroca,
  assertGestaoTrocaLaudoNaoFinalizado,
} from "../_shared/gestao-troca-laudo-ops.ts";
import {
  aprovarGestaoTrocaComParecer,
  buildGestaoTrocaParecerPreview,
} from "../_shared/gestao-troca-parecer-ops.ts";
import {
  insertTrocaEvento,
  liberarTrocaParaEstoque,
  loadTrocaHistoricoGrupo,
  registrarTrocaRepasse,
} from "../_shared/gestao-troca-ops.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  gestaoTrocaAdminClient,
  gestaoTrocaAuthedUser,
  jsonResponse,
  optionsResponse,
  parseFipePriceString,
} from "../_shared/gestao-troca-http.ts";

async function loadConfig(sb: SupabaseClient, userId: string): Promise<GestaoTrocaConfigCalc> {
  const { data } = await sb.from("gestao_troca_config").select("*").eq("user_id", userId)
    .maybeSingle();
  if (!data) return { ...DEFAULT_GESTAO_TROCA_CONFIG };
  return { ...DEFAULT_GESTAO_TROCA_CONFIG, ...(data as GestaoTrocaConfigCalc) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await gestaoTrocaAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const sb = gestaoTrocaAdminClient();

    if (action === "recalcular") {
      const trocaId = String(body?.troca_id ?? "");
      const { data: troca } = await sb.from("gestao_troca").select("*")
        .eq("id", trocaId).eq("user_id", user.id).maybeSingle();
      if (!troca) throw new Error("Troca não encontrada.");
      assertGestaoTrocaLaudoNaoFinalizado(troca);
      const config = await loadConfig(sb, user.id);
      const historico = await loadTrocaHistoricoGrupo(
        sb,
        user.id,
        String(troca.marca),
        String(troca.modelo),
      );
      let procedencia: ProcedenciaResumoJson | null = null;
      if (troca.procedencia_consulta_id) {
        const { data: pc } = await sb.from("veiculo_procedencia_consulta")
          .select("resumo_json").eq("id", troca.procedencia_consulta_id).maybeSingle();
        procedencia = pc?.resumo_json as ProcedenciaResumoJson | null;
      }
      const calc = calcTrocaPreco({
        km: troca.km != null ? Number(troca.km) : null,
        ano_modelo: troca.ano_modelo != null ? Number(troca.ano_modelo) : null,
        kbb_troca: troca.kbb_troca != null ? Number(troca.kbb_troca) : null,
        kbb_loja: troca.kbb_loja != null ? Number(troca.kbb_loja) : null,
        kbb_km_caracteristico: troca.kbb_km_caracteristico != null
          ? Number(troca.kbb_km_caracteristico)
          : null,
        fipe_valor: troca.fipe_valor != null ? Number(troca.fipe_valor) : null,
        preparacao_estimada: Number(troca.preparacao_estimada ?? 0),
        valor_proposto: troca.valor_proposto != null ? Number(troca.valor_proposto) : null,
      }, config, historico, procedencia);

      await sb.from("gestao_troca").update({
        valor_sugerido: calc.valor_sugerido,
        faixa_verde_min: calc.faixa_verde_min,
        faixa_verde_max: calc.faixa_verde_max,
        teto: calc.teto,
        semaforo: calc.semaforo,
        justificativas_json: calc.justificativas,
        updated_at: new Date().toISOString(),
      }).eq("id", trocaId);

      return jsonResponse({ success: true, calc, historico });
    }

    if (action === "analisar_fotos") {
      const r = await iniciarGestaoTrocaIaAnalise(sb, user.id, String(body?.troca_id ?? ""));
      return jsonResponse({ success: true, ...r });
    }

    if (action === "status_analise") {
      const r = await statusAnaliseGestaoTroca(sb, user.id, {
        analise_id: body?.analise_id != null ? String(body.analise_id) : undefined,
        troca_id: body?.troca_id != null ? String(body.troca_id) : undefined,
      });
      if (!r.ok) {
        return jsonResponse({ success: false, error: r.error }, r.status);
      }
      return jsonResponse({ success: true, analise: r.analise, itens: r.itens });
    }

    if (action === "decidir_item_ia") {
      const r = await decidirItemIaGestaoTroca(
        sb,
        user.id,
        String(body?.item_id ?? ""),
        String(body?.decisao ?? "") as "confirmado" | "descartado",
      );
      return jsonResponse({ success: true, ...r });
    }

    if (action === "confirmar_km") {
      await confirmarKmPainelGestaoTroca(sb, user.id, String(body?.troca_id ?? ""));
      return jsonResponse({ success: true });
    }

    if (action === "custos_listar") {
      const custos = await listGestaoTrocaIaCustos(sb, user.id);
      return jsonResponse({ success: true, custos });
    }

    if (action === "custos_salvar") {
      const raw = body?.custos;
      if (!Array.isArray(raw)) throw new Error("Informe custos.");
      const custos = raw.map((row: Record<string, unknown>) => ({
        categoria: String(row.categoria ?? ""),
        gravidade: String(row.gravidade ?? ""),
        valor: Number(row.valor ?? 0),
      })) as GestaoTrocaIaCustoRow[];
      await saveGestaoTrocaIaCustos(sb, user.id, custos);
      return jsonResponse({ success: true });
    }

    if (action === "transicao") {
      const trocaId = String(body?.troca_id ?? "");
      const acao = String(body?.acao ?? "") as GestaoTrocaAcao;
      const { data: troca } = await sb.from("gestao_troca").select("id, status, km_painel_conferido")
        .eq("id", trocaId).eq("user_id", user.id).maybeSingle();
      if (!troca) throw new Error("Troca não encontrada.");
      if (acao === "solicitar_aprovacao") {
        await assertPodeSolicitarAprovacaoTroca(
          sb,
          user.id,
          trocaId,
          troca.km_painel_conferido === true,
        );
      }
      const novoStatus = assertGestaoTrocaTransicao(String(troca.status) as never, acao);
      const patch: Record<string, unknown> = {
        status: novoStatus,
        updated_at: new Date().toISOString(),
      };
      if (acao === "aprovar") {
        patch.valor_aprovado = Number(body?.valor_aprovado ?? 0);
        patch.aprovado_por = user.id;
        patch.aprovado_em = new Date().toISOString();
      }
      if (acao === "fechar") {
        patch.valor_fechado = Number(body?.valor_fechado ?? body?.valor_aprovado ?? 0);
        patch.fechado_em = new Date().toISOString();
      }
      await sb.from("gestao_troca").update(patch).eq("id", trocaId);
      await insertTrocaEvento(sb, {
        troca_id: trocaId,
        user_id: user.id,
        tipo: acao,
        descricao: `Status → ${novoStatus}`,
        autor: user.email ?? user.id,
      });
      return jsonResponse({ success: true, status: novoStatus });
    }

    if (action === "liberar_estoque") {
      const r = await liberarTrocaParaEstoque(
        sb,
        user.id,
        String(body?.troca_id ?? ""),
        user.email ?? "painel",
        Number(body?.preco_venda ?? 0),
      );
      return jsonResponse({ success: true, ...r });
    }

    if (action === "repasse") {
      const r = await registrarTrocaRepasse(
        sb,
        user.id,
        String(body?.troca_id ?? ""),
        {
          comprador: String(body?.comprador ?? ""),
          valor: Number(body?.valor ?? 0),
          data: String(body?.data ?? new Date().toISOString().slice(0, 10)),
        },
        user.email ?? "painel",
      );
      return jsonResponse({ success: true, ...r });
    }

    if (action === "parecer_preview") {
      const r = await buildGestaoTrocaParecerPreview(sb, user.id, String(body?.troca_id ?? ""));
      return jsonResponse({ success: true, ...r });
    }

    if (action === "aprovar_com_parecer") {
      await aprovarGestaoTrocaComParecer(
        sb,
        user.id,
        user.email ?? user.id,
        String(body?.troca_id ?? ""),
      );
      return jsonResponse({ success: true });
    }

    if (action === "finalizar_laudo") {
      const r = await finalizarLaudoGestaoTroca(
        sb,
        user.id,
        user.email ?? user.id,
        String(body?.troca_id ?? ""),
      );
      return jsonResponse({ success: true, ...r });
    }

    if (action === "reabrir_laudo") {
      await reabrirLaudoGestaoTroca(
        sb,
        user.id,
        user.email ?? user.id,
        String(body?.troca_id ?? ""),
        String(body?.motivo ?? ""),
      );
      return jsonResponse({ success: true });
    }

    if (action === "fipe_buscar") {
      const marca = String(body?.marca ?? "");
      const modelo = String(body?.modelo ?? "");
      const ano = String(body?.ano_modelo ?? body?.ano ?? "");
      const brand = await buscarMarca(marca);
      if (!brand) throw new Error("Marca FIPE não encontrada.");
      const models = await listarModelos(brand.code, modelo);
      const model = models[0];
      if (!model) throw new Error("Modelo FIPE não encontrado.");
      const years = await listarAnos(brand.code, model.code, ano);
      const year = years.find((y) => String(y.name).includes(ano)) ?? years[0];
      if (!year) throw new Error("Ano FIPE não encontrado.");
      const price = await consultarPreco({
        brandId: brand.code,
        modelId: model.code,
        yearId: year.code,
      });
      const valor = parseFipePriceString(price.price);
      return jsonResponse({
        success: true,
        fipe_valor: valor,
        fipe_mes_ref: price.referenceMonth,
        label: `${price.brand} ${price.model}`,
      });
    }

    return jsonResponse({ success: false, error: "Ação inválida" }, 400);
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
