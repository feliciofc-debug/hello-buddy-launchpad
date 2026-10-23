#!/usr/bin/env -S deno run --allow-env --allow-net

import { webmotorsAutenticar } from "../supabase/functions/_shared/webmotors-auth.ts";
import {
  loadWebmotorsHomologCredentials,
} from "../supabase/functions/_shared/webmotors-config.ts";
import {
  WEBMOTORS_ANUNCIO_SN_FIELDS,
  webmotorsAnuncioSnFromBooleans,
} from "../supabase/functions/_shared/webmotors-anuncio-sn.ts";
import {
  wmAlterarCarro,
  type WmAnuncioPayload,
  wmExcluirCarro,
  wmIncluirCarro,
  wmObterEstoqueAtual,
} from "../supabase/functions/_shared/webmotors-car-api.ts";
import { normalizeWebmotorsPlaca } from "../supabase/functions/_shared/webmotors-map-car.ts";

const execute = Deno.args.includes("--execute");
const rawVehicle = Deno.env.get("WEBMOTORS_HML_TEST_VEHICLE_JSON") ?? "";

function loadTestVehicle(): WmAnuncioPayload {
  if (!rawVehicle) {
    throw new Error(
      "Defina WEBMOTORS_HML_TEST_VEHICLE_JSON com os códigos homologados do veículo de teste.",
    );
  }
  let parsed: Partial<WmAnuncioPayload>;
  try {
    parsed = JSON.parse(rawVehicle);
  } catch {
    throw new Error("WEBMOTORS_HML_TEST_VEHICLE_JSON não contém JSON válido.");
  }
  const numericFields: Array<keyof WmAnuncioPayload> = [
    "CodigoModalidade",
    "CodigoMarca",
    "CodigoModelo",
    "CodigoVersao",
    "AnoDoModelo",
    "AnoFabricacao",
    "CodigoCambio",
    "NrPortas",
    "CodigoCor",
    "CodigoCombustivel",
    "PrecoVenda",
  ];
  const missing = numericFields.filter((field) =>
    !Number.isFinite(Number(parsed[field])) || Number(parsed[field]) <= 0
  );
  if (missing.length) {
    throw new Error(
      `Campos obrigatórios ausentes no veículo de teste: ${
        missing.join(", ")
      }.`,
    );
  }
  const placa = normalizeWebmotorsPlaca(String(parsed.Placa ?? ""));
  if (!placa) {
    throw new Error("WEBMOTORS_HML_TEST_VEHICLE_JSON deve incluir Placa válida.");
  }
  const precoReal = Number.isFinite(Number(parsed.PrecoReal))
    ? Number(parsed.PrecoReal)
    : 0;
  const precoVenda = Number(parsed.PrecoVenda);
  if (precoReal !== 0 && precoReal <= precoVenda) {
    throw new Error(
      "PrecoReal deve ser 0 ou maior que PrecoVenda no veículo de teste.",
    );
  }
  const snBooleans: Record<string, boolean> = {};
  for (const field of WEBMOTORS_ANUNCIO_SN_FIELDS) {
    const v = (parsed as Record<string, unknown>)[field];
    if (v === true || v === "S" || v === "s") snBooleans[field] = true;
  }
  const sn = webmotorsAnuncioSnFromBooleans(snBooleans);
  return {
    CodigoAnuncio: 0,
    TipoAnuncio: "U",
    Km: Number(parsed.Km ?? 0),
    Placa: placa,
    Blindado: parsed.Blindado === "S" ? "S" : "N",
    ...sn,
    PrecoReal: precoReal,
    PrecoVenda: precoVenda,
    Observacao: String(parsed.Observacao ?? "Veículo de teste de homologação"),
    OpcionalCodigos: Array.isArray(parsed.OpcionalCodigos)
      ? parsed.OpcionalCodigos.map(Number).filter(Number.isFinite)
      : [],
    ...Object.fromEntries(
      numericFields.map((field) => [field, Number(parsed[field])]),
    ),
  } as WmAnuncioPayload;
}

async function main() {
  const credentials = loadWebmotorsHomologCredentials();
  const vehicle = loadTestVehicle();
  console.log("Webmotors HML: autenticando com credenciais do ambiente…");
  const hash = await webmotorsAutenticar({
    ambiente: "homolog",
    ...credentials,
  });
  console.log("Webmotors HML: autenticação concluída (token omitido).");

  if (!execute) {
    console.log(
      "DRY-RUN: incluir → alterar preço → consultar estoque → excluir. Nenhuma mutação executada.",
    );
    console.log(
      "Execute novamente com --execute após revisar o veículo de teste.",
    );
    return;
  }

  let codigoAnuncio: number | null = null;
  try {
    const created = await wmIncluirCarro("homolog", hash, vehicle);
    codigoAnuncio = created.codigoAnuncio;
    console.log(`Incluído anúncio de teste ${codigoAnuncio}.`);

    const novoPreco = Math.round((vehicle.PrecoVenda + 100) * 100) / 100;
    await wmAlterarCarro("homolog", hash, {
      ...vehicle,
      CodigoAnuncio: codigoAnuncio,
      PrecoVenda: novoPreco,
    });
    console.log("Preço do anúncio de teste alterado.");

    const estoque = await wmObterEstoqueAtual("homolog", hash);
    if (!estoque.includes(codigoAnuncio)) {
      throw new Error(
        "O anúncio criado não apareceu no estoque de homologação.",
      );
    }
    console.log("Anúncio confirmado no estoque de homologação.");
  } finally {
    if (codigoAnuncio != null) {
      await wmExcluirCarro("homolog", hash, codigoAnuncio, "3");
      console.log("Anúncio de teste excluído.");
    }
  }
}

if (import.meta.main) {
  await main().catch((error) => {
    console.error(`Falha no teste de homologação: ${(error as Error).message}`);
    Deno.exit(1);
  });
}
