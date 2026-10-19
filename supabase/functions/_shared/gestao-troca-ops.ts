import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hojeSaoPaulo } from "./gestao-date-br.ts";

type Db = SupabaseClient;

export async function insertTrocaEvento(
  sb: Db,
  input: {
    troca_id: string;
    user_id: string;
    tipo: string;
    descricao: string;
    valor?: number | null;
    autor?: string | null;
  },
): Promise<void> {
  await sb.from("gestao_troca_evento").insert({
    troca_id: input.troca_id,
    user_id: input.user_id,
    tipo: input.tipo,
    descricao: input.descricao,
    valor: input.valor ?? null,
    autor: input.autor ?? null,
  });
}

export async function loadTrocaHistoricoGrupo(
  sb: Db,
  userId: string,
  marca: string,
  modelo: string,
): Promise<{
  qtd_vendidos_12m: number;
  media_dias_giro: number | null;
  media_compra: number | null;
  margem_media_pct: number | null;
}> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: vendas } = await sb.from("veiculo_venda").select("veiculo_id, valor_venda, data_venda")
    .eq("user_id", userId).gte("data_venda", sinceStr);

  const ids = (vendas ?? []).map((v: { veiculo_id: string }) => v.veiculo_id);
  if (!ids.length) {
    return { qtd_vendidos_12m: 0, media_dias_giro: null, media_compra: null, margem_media_pct: null };
  }

  const { data: veiculos } = await sb.from("veiculos_estoque").select(
    "id, marca, modelo, created_at",
  ).eq("user_id", userId).in("id", ids);

  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const m = norm(marca);
  const mod = norm(modelo);
  const matchIds = new Set(
    (veiculos ?? []).filter((v: { marca: string; modelo: string }) =>
      norm(String(v.marca)) === m && norm(String(v.modelo)) === mod
    ).map((v: { id: string }) => v.id),
  );

  const vendasMatch = (vendas ?? []).filter((v: { veiculo_id: string }) =>
    matchIds.has(String(v.veiculo_id))
  );
  if (!vendasMatch.length) {
    return { qtd_vendidos_12m: 0, media_dias_giro: null, media_compra: null, margem_media_pct: null };
  }

  let somaCompra = 0;
  let somaMargem = 0;
  let somaDias = 0;
  let nMargem = 0;
  for (const v of vendasMatch) {
    const vid = String(v.veiculo_id);
    const veic = (veiculos ?? []).find((x: { id: string }) => x.id === vid);
    const { data: compra } = await sb.from("veiculo_compra").select("valor_compra, data_compra")
      .eq("user_id", userId).eq("veiculo_id", vid).maybeSingle();
    const compraVal = compra?.valor_compra != null ? Number(compra.valor_compra) : 0;
    somaCompra += compraVal;
    const vendaVal = Number(v.valor_venda);
    if (compraVal > 0 && vendaVal > 0) {
      somaMargem += ((vendaVal - compraVal) / vendaVal) * 100;
      nMargem += 1;
    }
    const created = veic?.created_at ? Date.parse(String(veic.created_at)) : NaN;
    const sold = Date.parse(String(v.data_venda));
    if (Number.isFinite(created) && Number.isFinite(sold)) {
      somaDias += Math.max(0, Math.floor((sold - created) / 86400000));
    }
  }

  return {
    qtd_vendidos_12m: vendasMatch.length,
    media_dias_giro: Math.round(somaDias / vendasMatch.length),
    media_compra: Math.round((somaCompra / vendasMatch.length) * 100) / 100,
    margem_media_pct: nMargem ? Math.round((somaMargem / nMargem) * 10) / 10 : null,
  };
}

export async function claimGestaoTrocaDestino(
  sb: Db,
  userId: string,
  trocaId: string,
  destino: "estoque" | "repasse",
): Promise<boolean> {
  const { data, error } = await sb.from("gestao_troca").update({
    destino,
    updated_at: new Date().toISOString(),
  })
    .eq("id", trocaId)
    .eq("user_id", userId)
    .is("veiculo_id", null)
    .is("destino", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Não foi possível reservar destino.");
  return !!data?.id;
}

async function releaseGestaoTrocaDestinoLock(
  sb: Db,
  userId: string,
  trocaId: string,
): Promise<void> {
  await sb.from("gestao_troca").update({
    destino: null,
    updated_at: new Date().toISOString(),
  })
    .eq("id", trocaId)
    .eq("user_id", userId)
    .is("veiculo_id", null);
}

export async function liberarTrocaParaEstoque(
  sb: Db,
  userId: string,
  trocaId: string,
  autorLabel: string,
  precoVenda: number,
): Promise<{ veiculo_id: string }> {
  const preco = Number(precoVenda);
  if (!Number.isFinite(preco) || preco <= 0) throw new Error("Informe o preço de venda.");

  const { data: troca, error } = await sb.from("gestao_troca").select("*")
    .eq("id", trocaId).eq("user_id", userId).maybeSingle();
  if (error || !troca) throw new Error("Troca não encontrada.");
  if (String(troca.status) !== "fechada") throw new Error("Troca precisa estar fechada.");
  if (troca.veiculo_id || troca.destino) throw new Error("Destino já registrado.");
  if (troca.valor_fechado == null) throw new Error("Informe valor fechado.");

  const claimed = await claimGestaoTrocaDestino(sb, userId, trocaId, "estoque");
  if (!claimed) throw new Error("Destino já registrado.");

  try {
    const { data: veic, error: vErr } = await sb.from("veiculos_estoque").insert({
      user_id: userId,
      marca: troca.marca,
      modelo: troca.modelo,
      versao: troca.versao,
      ano_fabricacao: troca.ano_fabricacao,
      ano_modelo: troca.ano_modelo,
      km: troca.km,
      cor: troca.cor,
      placa: troca.placa,
      status: "disponivel",
      segmento: "carro",
      preco: preco,
      fotos: null,
    }).select("id").single();
    if (vErr || !veic?.id) throw new Error("Não foi possível criar veículo no estoque.");

    const vid = String(veic.id);
    const dataCompra = troca.fechado_em
      ? String(troca.fechado_em).slice(0, 10)
      : hojeSaoPaulo();

    await sb.from("veiculo_compra").upsert({
      user_id: userId,
      veiculo_id: vid,
      valor_compra: Number(troca.valor_fechado),
      data_compra: dataCompra,
      origem: "troca",
    }, { onConflict: "user_id,veiculo_id" });

    const { data: despesas } = await sb.from("gestao_troca_despesa").select("*")
      .eq("troca_id", trocaId).eq("user_id", userId).is("deleted_at", null);

    for (const d of despesas ?? []) {
      await sb.from("veiculo_despesas").insert({
        user_id: userId,
        veiculo_id: vid,
        data: String(d.data ?? dataCompra).slice(0, 10),
        categoria: String(d.categoria),
        valor: Number(d.valor),
        descricao: d.descricao ? String(d.descricao) : "Preparação troca",
        origem_lancamento: "painel",
        lancado_por: autorLabel,
      });
    }

    await sb.from("gestao_troca").update({
      veiculo_id: vid,
      updated_at: new Date().toISOString(),
    }).eq("id", trocaId);

    await insertTrocaEvento(sb, {
      troca_id: trocaId,
      user_id: userId,
      tipo: "liberar_estoque",
      descricao: `Liberado para venda — preço ${preco}`,
      valor: preco,
      autor: autorLabel,
    });

    return { veiculo_id: vid };
  } catch (e) {
    await releaseGestaoTrocaDestinoLock(sb, userId, trocaId);
    throw e;
  }
}

export async function registrarTrocaRepasse(
  sb: Db,
  userId: string,
  trocaId: string,
  input: { comprador: string; valor: number; data: string },
  autorLabel: string,
): Promise<{ veiculo_id: string }> {
  const { data: troca } = await sb.from("gestao_troca").select("*")
    .eq("id", trocaId).eq("user_id", userId).maybeSingle();
  if (!troca) throw new Error("Troca não encontrada.");
  if (String(troca.status) !== "fechada") throw new Error("Troca precisa estar fechada.");
  if (troca.veiculo_id || troca.destino) throw new Error("Destino já registrado.");

  const claimed = await claimGestaoTrocaDestino(sb, userId, trocaId, "repasse");
  if (!claimed) throw new Error("Destino já registrado.");

  try {
  const { data: veic, error: vErr } = await sb.from("veiculos_estoque").insert({
    user_id: userId,
    marca: troca.marca,
    modelo: troca.modelo,
    versao: troca.versao,
    ano_fabricacao: troca.ano_fabricacao,
    ano_modelo: troca.ano_modelo,
    km: troca.km,
    cor: troca.cor,
    placa: troca.placa,
    status: "vendido",
    segmento: "carro",
    preco: null,
  }).select("id").single();
  if (vErr || !veic?.id) throw new Error("Não foi possível registrar repasse.");

  const vid = String(veic.id);
  const dataFech = troca.fechado_em ? String(troca.fechado_em).slice(0, 10) : hojeSaoPaulo();

  await sb.from("veiculo_compra").upsert({
    user_id: userId,
    veiculo_id: vid,
    valor_compra: Number(troca.valor_fechado ?? 0),
    data_compra: dataFech,
    origem: "troca",
  }, { onConflict: "user_id,veiculo_id" });

  const { data: despesas } = await sb.from("gestao_troca_despesa").select("*")
    .eq("troca_id", trocaId).eq("user_id", userId).is("deleted_at", null);
  for (const d of despesas ?? []) {
    await sb.from("veiculo_despesas").insert({
      user_id: userId,
      veiculo_id: vid,
      data: String(d.data ?? dataFech).slice(0, 10),
      categoria: String(d.categoria),
      valor: Number(d.valor),
      descricao: d.descricao ? String(d.descricao) : "Preparação troca",
      origem_lancamento: "painel",
    });
  }

  await sb.from("veiculo_venda").upsert({
    user_id: userId,
    veiculo_id: vid,
    valor_venda: Number(input.valor),
    data_venda: input.data.slice(0, 10),
    marcou_vendido: true,
  }, { onConflict: "user_id,veiculo_id" });

  await sb.from("gestao_troca").update({
    veiculo_id: vid,
    repasse_comprador: input.comprador,
    repasse_valor: input.valor,
    repasse_data: input.data.slice(0, 10),
    updated_at: new Date().toISOString(),
  }).eq("id", trocaId);

  await insertTrocaEvento(sb, {
    troca_id: trocaId,
    user_id: userId,
    tipo: "repasse",
    descricao: `Repasse para ${input.comprador} — ${input.valor}`,
    valor: input.valor,
    autor: autorLabel,
  });

  return { veiculo_id: vid };
  } catch (e) {
    await releaseGestaoTrocaDestinoLock(sb, userId, trocaId);
    throw e;
  }
}
