import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  type CrlvCampo,
  type CrlvParserResultado,
  validarRenavam,
} from "./crlv-parser.ts";
import { auditGestaoDocumento } from "./gestao-cofre-upload.ts";
import {
  MolicarDailyLimitError,
  runMolicarConsulta,
} from "./molicar-service.ts";
import {
  brazilianPlatesEquivalent,
  normalizeBrazilianPlate,
} from "./vehicle-plate.ts";

export type CrlvStockLink = {
  id: string;
  label: string;
};

export type CrlvFieldOrigin = "documento" | "Molicar";
export type CrlvFieldOrigins = Record<
  "veiculo" | "documento" | "proprietario",
  Record<string, CrlvFieldOrigin>
>;

export type CrlvMolicarCompletion = {
  leitura: CrlvParserResultado;
  origens: CrlvFieldOrigins;
  completado: boolean;
  aviso: string | null;
};

function fieldOrigins(parser: CrlvParserResultado): CrlvFieldOrigins {
  const section = (fields: Record<string, CrlvCampo<unknown>>) =>
    Object.fromEntries(
      Object.entries(fields)
        .filter(([, field]) => field?.valor != null)
        .map(([key]) => [key, "documento" as const]),
    );
  return {
    veiculo: section(
      parser.veiculo as unknown as Record<string, CrlvCampo<unknown>>,
    ),
    documento: section(
      parser.documento as unknown as Record<string, CrlvCampo<unknown>>,
    ),
    proprietario: section(
      parser.proprietario as unknown as Record<string, CrlvCampo<unknown>>,
    ),
  };
}

function molicarWarning(error: unknown): string {
  const message = String((error as Error)?.message ?? "");
  if (
    error instanceof MolicarDailyLimitError ||
    /limite di[aá]rio/i.test(message)
  ) {
    return "A Molicar atingiu o limite de 30 consultas da loja hoje; mostrei somente o que li no documento.";
  }
  if (/conecte a molicar|conex[aã]o molicar|credencia/i.test(message)) {
    return "A Molicar não está conectada nesta loja; mostrei somente o que li no documento.";
  }
  return "A Molicar está indisponível agora; mostrei somente o que li no documento.";
}

function nonEmpty(value: unknown): string | null {
  const clean = String(value ?? "").trim();
  return clean ? clean : null;
}

function positiveYear(value: unknown): number | null {
  const year = Number(value);
  const max = new Date().getUTCFullYear() + 2;
  return Number.isInteger(year) && year >= 1900 && year <= max ? year : null;
}

function setMolicarField<T>(
  field: CrlvCampo<T>,
  value: T | null,
  origins: Record<string, CrlvFieldOrigin>,
  key: string,
  filled: string[],
): void {
  if (field.valor != null || value == null) return;
  field.valor = value;
  field.confianca = "media";
  origins[key] = "Molicar";
  filled.push(key);
}

export async function completeCrlvWithMolicar(input: {
  sb: SupabaseClient;
  userId: string;
  documentoId: string;
  leitura: CrlvParserResultado;
  runConsulta?: typeof runMolicarConsulta;
}): Promise<CrlvMolicarCompletion> {
  const leitura = structuredClone(input.leitura);
  const origens = fieldOrigins(leitura);
  const plate = normalizeBrazilianPlate(leitura.veiculo.placa.valor);
  if (!plate) {
    return { leitura, origens, completado: false, aviso: null };
  }

  let aviso: string | null = null;
  const filled: string[] = [];
  try {
    const run = input.runConsulta ?? runMolicarConsulta;
    const result = await run(input.sb, input.userId, {
      placa: plate,
      origem: "entrada",
    }) as Record<string, unknown>;
    if (result.not_found === true) {
      aviso =
        "A Molicar não encontrou esta placa; mostrei somente o que li no documento.";
    } else {
      const dados = (result.dados ?? {}) as Record<string, unknown>;
      const brandModel = [
        nonEmpty(dados.marca),
        nonEmpty(dados.modelo),
        nonEmpty(dados.versao),
      ].filter((value): value is string => !!value).join(" ");
      setMolicarField(
        leitura.veiculo.marca_modelo_versao,
        brandModel || null,
        origens.veiculo,
        "marca_modelo_versao",
        filled,
      );
      setMolicarField(
        leitura.veiculo.ano_fabricacao,
        positiveYear(dados.ano_fabricacao),
        origens.veiculo,
        "ano_fabricacao",
        filled,
      );
      setMolicarField(
        leitura.veiculo.ano_modelo,
        positiveYear(dados.ano_modelo),
        origens.veiculo,
        "ano_modelo",
        filled,
      );
      for (
        const [key, value] of [
          ["combustivel", dados.combustivel],
          ["cor", dados.cor],
        ] as const
      ) {
        setMolicarField(
          leitura.veiculo[key],
          nonEmpty(value),
          origens.veiculo,
          key,
          filled,
        );
      }
      const vin = nonEmpty(result.vin)?.replace(/[^A-Z0-9]/gi, "")
        .toUpperCase() ?? null;
      setMolicarField(
        leitura.veiculo.chassi,
        vin && /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : null,
        origens.veiculo,
        "chassi",
        filled,
      );
      const renavam = nonEmpty(result.renavam)?.replace(/\D/g, "") ?? null;
      setMolicarField(
        leitura.veiculo.renavam,
        renavam && validarRenavam(renavam) ? renavam : null,
        origens.veiculo,
        "renavam",
        filled,
      );
    }
  } catch (error) {
    aviso = molicarWarning(error);
  }

  const core = [
    leitura.veiculo.placa,
    leitura.veiculo.renavam,
    leitura.veiculo.chassi,
    leitura.veiculo.marca_modelo_versao,
    leitura.veiculo.ano_modelo,
  ];
  leitura.leitura_fraca = core.filter((field) => field.valor != null).length < 3;
  const { error } = await input.sb.from("gestao_documento").update({
    campos_veiculo: {
      veiculo: leitura.veiculo,
      documento: leitura.documento,
      observacoes: leitura.observacoes,
      origens,
    },
  }).eq("id", input.documentoId).eq("user_id", input.userId);
  if (error) throw error;
  await auditGestaoDocumento(
    input.sb,
    input.documentoId,
    input.userId,
    "ler",
    {
      completar_molicar: true,
      status: aviso ? "parcial" : "concluido",
      campos_preenchidos: filled,
    },
  );
  return {
    leitura,
    origens,
    completado: filled.length > 0,
    aviso,
  };
}

export async function autoLinkCrlvToStock(
  sb: SupabaseClient,
  userId: string,
  documentoId: string,
  parser: CrlvParserResultado,
): Promise<CrlvStockLink | null> {
  const plate = normalizeBrazilianPlate(parser.veiculo.placa.valor);
  if (!plate) return null;
  const { data, error } = await sb.from("veiculos_estoque")
    .select("id,marca,modelo,versao,placa")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Falha ao procurar o veículo no estoque");
  const vehicle = (data ?? []).find((row: Record<string, unknown>) =>
    brazilianPlatesEquivalent(row.placa, plate)
  ) as Record<string, unknown> | undefined;
  if (!vehicle?.id) return null;
  const { error: linkError } = await sb.from("gestao_documento").update({
    veiculo_id: String(vehicle.id),
  }).eq("id", documentoId).eq("user_id", userId);
  if (linkError) throw new Error("Falha ao vincular o CRLV ao estoque");
  await auditGestaoDocumento(sb, documentoId, userId, "vincular_automatico", {
    veiculo_id: String(vehicle.id),
    origem: "whatsapp",
  });
  const label = `${String(vehicle.marca ?? "").trim()} ${
    String(vehicle.modelo ?? "").trim()
  } ${String(vehicle.versao ?? "").trim()}`.replace(/\s+/g, " ").trim();
  return {
    id: String(vehicle.id),
    label: label || "veículo do estoque",
  };
}

export function crlvWhatsappActionButtons(
  documentoId: string,
  linkedVehicleId?: string | null,
  plate?: string | null,
) {
  const normalizedPlate = normalizeBrazilianPlate(plate);
  const security = normalizedPlate
    ? {
      id: `molicar_wa:procedencia:${normalizedPlate}`,
      title: "Consultar segurança",
    }
    : null;
  return {
    body: "O que você quer fazer com este CRLV?",
    buttons: linkedVehicleId
      ? [
        {
          id: `cofre_doc_salvar:${documentoId}:${linkedVehicleId}`,
          title: "Salvar na plataforma",
        },
        {
          id: `cofre_doc_desvincular:${documentoId}:${linkedVehicleId}`,
          title: "Desfazer vínculo",
        },
        ...(security ? [security] : []),
      ]
      : [
        {
          id: `cofre_doc_salvar:${documentoId}`,
          title: "Salvar na plataforma",
        },
        { id: `cofre_doc_vistoria:${documentoId}`, title: "Vistoria" },
        ...(security ? [security] : []),
      ],
  };
}
