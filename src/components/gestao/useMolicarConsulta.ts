import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GestaoMolicarSnapshot } from "@/lib/gestao-troca-types.ts";

type MolicarOrigem = "entrada" | "estoque" | "troca" | "refresh" | "manual";

type UseMolicarConsultaOptions = {
  userId: string;
  placa?: string | null;
  veiculoId?: string | null;
  trocaId?: string | null;
  origem: MolicarOrigem;
  enabled?: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const first = (
  records: Record<string, unknown>[],
  keys: string[],
): unknown => {
  for (const record of records) {
    for (const key of keys) {
      if (record[key] != null && record[key] !== "") return record[key];
    }
  }
  return null;
};

const text = (value: unknown): string | null =>
  value == null || String(value).trim() === "" ? null : String(value).trim();

const number = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const raw = typeof value === "string" ? value.replace(/[^\d,.-]/g, "") : value;
  const parsed = typeof raw === "string"
    ? Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw)
    : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const PROCEDENCIA_LABELS: Record<string, string> = {
  robberyorftheft: "Roubo/furto",
  insuranceclaim: "Sinistro",
  hasgravame: "Gravame",
  renajudrestrictionindicator: "Restrição Renajud",
  hasadministrative: "Restrição administrativa",
  recall: "Recall",
  leilao: "Leilão",
  auction: "Leilão",
  finevalue: "Multas",
  ipvavalue: "IPVA",
  licensefeevalue: "Licenciamento",
};

function molicarProcedencia(raw: unknown): {
  dados: Record<string, unknown> | null;
  alertas: string[];
} {
  const dados = asRecord(raw);
  if (!Object.keys(dados).length) return { dados: null, alertas: [] };
  const alertas = new Set<string>();
  const visit = (value: unknown, key = "") => {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) =>
        visit(child, childKey)
      );
      return;
    }
    const normalized = key.replace(/[_\s-]/g, "").toLowerCase();
    const active = value === true ||
      (typeof value === "number" && value > 0) ||
      (typeof value === "string" && !/^(?:false|nao|não|0|null|sem)$/i.test(value.trim()));
    if (active && PROCEDENCIA_LABELS[normalized]) {
      alertas.add(PROCEDENCIA_LABELS[normalized]);
    }
  };
  visit(dados);
  return { dados, alertas: [...alertas] };
}

export function normalizeMolicarSnapshot(raw: unknown): GestaoMolicarSnapshot {
  const envelope = asRecord(raw);
  const row = asRecord(envelope.consulta ?? envelope.resultado ?? envelope.data ?? raw);
  const dados = asRecord(row.dados ?? row.veiculo ?? envelope.dados);
  const precos = asRecord(row.precos ?? envelope.precos);
  const dadosPrecos = {
    ...asRecord(dados.prices),
    ...asRecord(dados.precos),
    ...asRecord(dados.price),
  };
  const priceRecords = [precos, dadosPrecos, dados, row, envelope];
  const dataReferencia = text(first(priceRecords, [
    "data_referencia",
    "dataReferencia",
    "mes_referencia",
    "mesReferencia",
    "reference_date",
  ]));
  const atualizadoEm = text(first([dados, precos, row, envelope], [
    "atualizado_em",
    "atualizadoEm",
    "data_atualizacao",
    "dataAtualizacao",
    "updated_at",
  ]));
  const origem = text(row.origem);
  const cache = envelope.cache === true || envelope.from_cache === true;
  const procedencia = molicarProcedencia(
    row.procedencia ?? envelope.procedencia,
  );
  return {
    id: text(row.id),
    placa: text(first([row, dados, envelope], ["placa", "plate"])),
    molicarId: text(first([row, dados, envelope], ["molicar_id", "molicarId", "id_molicar"])),
    referencia: number(first(priceRecords, [
      "referencia",
      "reference",
      "referencePrice",
      "preco_referencia",
      "valor_referencia",
    ])),
    b2c: number(first(priceRecords, ["b2c", "B2C", "preco_b2c", "valor_b2c"])),
    b2b: number(first(priceRecords, ["b2b", "B2B", "preco_b2b", "valor_b2b"])),
    c2c: number(first(priceRecords, ["c2c", "C2C", "preco_c2c", "valor_c2c"])),
    c2b: number(first(priceRecords, ["c2b", "C2B", "preco_c2b", "valor_c2b"])),
    novo: number(first(priceRecords, ["novo", "new", "newPrice", "preco_novo", "valor_novo"])),
    dataReferencia,
    atualizadoEm,
    consultadoEm: text(first([row, envelope], ["consultado_em", "consultadoEm", "created_at"])),
    proveniencia: [
      "Molicar",
      origem ? `origem ${origem}` : null,
      cache ? "cache" : null,
    ].filter(Boolean).join(" · "),
    procedencia: procedencia.dados,
    alertasProcedencia: procedencia.alertas,
    dados: {
      marca: text(first([dados, row], ["marca", "brand", "brandName", "make"])),
      modelo: text(first([dados, row], ["modelo", "model", "modelName"])),
      versao: text(first([dados, row], ["versao", "version", "versionName", "trim"])),
      anoFabricacao: number(first([dados, row], ["ano_fabricacao", "anoFabricacao", "manufacture_year"])),
      anoModelo: number(first([dados, row], ["ano_modelo", "anoModelo", "model_year"])),
      cor: text(first([dados, row], ["cor", "color"])),
      combustivel: text(first([dados, row], ["combustivel", "fuel"])),
      cambio: text(first([dados, row], ["cambio", "transmissao", "transmission"])),
      portas: number(first([dados, row], ["portas", "doors"])),
      cilindradaCc: number(first([dados, row], ["cilindrada_cc", "cilindradaCc", "engine_cc"])),
    },
  };
}

export function useMolicarConsulta({
  userId,
  placa,
  veiculoId,
  trocaId,
  origem,
  enabled = true,
}: UseMolicarConsultaOptions) {
  const normalizedPlate = (placa ?? "").replace(/\W/g, "").toUpperCase();
  const [snapshot, setSnapshot] = useState<GestaoMolicarSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [consulting, setConsulting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    if (!enabled || !userId || (!veiculoId && !trocaId && normalizedPlate.length !== 7)) {
      setSnapshot(null);
      return null;
    }
    setLoading(true);
    setError(null);
    let query = supabase.from("molicar_consulta" as "veiculos_estoque")
      .select("*")
      .eq("user_id", userId);
    if (veiculoId) query = query.eq("veiculo_id", veiculoId);
    else if (trocaId) query = query.eq("troca_id", trocaId);
    else query = query.eq("placa", normalizedPlate);
    const { data, error: queryError } = await query
      .order("consultado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLoading(false);
    if (queryError) {
      setError("Não foi possível carregar a última consulta Molicar.");
      return null;
    }
    const next = data ? normalizeMolicarSnapshot(data) : null;
    setSnapshot(next);
    return next;
  }, [enabled, normalizedPlate, trocaId, userId, veiculoId]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  const consultar = useCallback(async () => {
    if (normalizedPlate.length !== 7) {
      setError("Informe uma placa com 7 caracteres.");
      return null;
    }
    setConsulting(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke(
      "molicar-consulta",
      {
        body: {
          placa: normalizedPlate,
          origem,
          veiculo_id: veiculoId ?? null,
          troca_id: trocaId ?? null,
          force: true,
        },
      },
    );
    setConsulting(false);
    if (invokeError || data?.error) {
      setError(
        String(data?.error ?? invokeError?.message ?? "Não foi possível consultar a Molicar."),
      );
      return null;
    }
    const next = normalizeMolicarSnapshot(data);
    setSnapshot(next);
    return next;
  }, [normalizedPlate, origem, trocaId, veiculoId]);

  return {
    snapshot,
    loading,
    consulting,
    error,
    consultar,
    reload: loadLatest,
  };
}
