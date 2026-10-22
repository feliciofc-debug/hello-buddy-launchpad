#!/usr/bin/env -S deno run --allow-env --allow-net

import { webmotorsAutenticar } from "../supabase/functions/_shared/webmotors-auth.ts";
import {
  loadWebmotorsHomologCredentials,
} from "../supabase/functions/_shared/webmotors-config.ts";
import {
  wmAlterarCarro,
  type WmAnuncioPayload,
  wmExcluirCarro,
  wmIncluirCarro,
  wmObterEstoqueAtual,
} from "../supabase/functions/_shared/webmotors-car-api.ts";

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
    "PrecoReal",
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
  return {
    CodigoAnuncio: 0,
    TipoAnuncio: "U",
    Km: Number(parsed.Km ?? 0),
    Blindado: parsed.Blindado === "S" ? "S" : "N",
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
      PrecoReal: novoPreco,
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
