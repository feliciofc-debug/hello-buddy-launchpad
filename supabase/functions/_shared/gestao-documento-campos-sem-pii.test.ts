import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  camposVeiculoSemPii,
  camposVeiculoViolatesPiiConstraint,
  CAMPOS_VEICULO_PII_KEYS,
} from "./gestao-cofre-campos.ts";
import { parseCrlvText } from "./crlv-parser.ts";

/**
 * Espelha `gestao_documento_campos_sem_pii` em
 * supabase/migrations/20261032270000_seg_doc_cofre.sql — mantenha em sync.
 */
Deno.test("CRLV-FIM.1 — constraint espelhada rejeita PII em qualquer nível", () => {
  const withOrigensProprietario = {
    veiculo: { placa: { valor: "ABC1D23" } },
    origens: {
      veiculo: { placa: "digitado" },
      documento: {},
      proprietario: { nome: "documento" },
    },
  };
  assertEquals(
    camposVeiculoViolatesPiiConstraint(withOrigensProprietario),
    true,
  );
  const sanitized = camposVeiculoSemPii(withOrigensProprietario);
  assertEquals(camposVeiculoViolatesPiiConstraint(sanitized), false);
  assertEquals(
    (sanitized as Record<string, unknown>).origens &&
      typeof (sanitized as Record<string, unknown>).origens === "object"
      ? (sanitized as { origens: Record<string, unknown> }).origens
        .proprietario
      : undefined,
    undefined,
  );
});

Deno.test("CRLV-FIM.1 — lista de chaves proibidas alinhada à migration", () => {
  const migrationKeys = [
    "proprietario",
    "proprietario_nome",
    "nome",
    "cpf",
    "cnpj",
    "cpf_cnpj",
    "documento_proprietario",
  ];
  assertEquals([...CAMPOS_VEICULO_PII_KEYS], migrationKeys);
  for (const key of migrationKeys) {
    assertEquals(camposVeiculoViolatesPiiConstraint({ [key]: "x" }), true);
    assertEquals(
      camposVeiculoViolatesPiiConstraint(camposVeiculoSemPii({ [key]: "x" })),
      false,
    );
  }
});

Deno.test("CRLV-FIM.1 — payloads típicos de escrita passam após sanitize", () => {
  const leitura = parseCrlvText(
    "PLACA: ABC1D23\nNOME: FULANO\nCPF: 123.456.789-00",
    "ocr",
  );
  const uploadPayload = camposVeiculoSemPii({
    veiculo: leitura.veiculo,
    documento: leitura.documento,
    observacoes: leitura.observacoes,
  });
  assertEquals(camposVeiculoViolatesPiiConstraint(uploadPayload), false);

  const molicarPayload = camposVeiculoSemPii({
    veiculo: leitura.veiculo,
    documento: leitura.documento,
    observacoes: leitura.observacoes,
    origens: {
      veiculo: { placa: "documento" },
      documento: {},
      proprietario: { nome: "documento", cpf_cnpj: "documento" },
    },
  });
  assertEquals(camposVeiculoViolatesPiiConstraint(molicarPayload), false);

  const confirmPayload = camposVeiculoSemPii({
    veiculo: leitura.veiculo,
    confirmados: { placa: "ABC1D23" },
  });
  assertEquals(camposVeiculoViolatesPiiConstraint(confirmPayload), false);
});

Deno.test("CRLV-FIM.1 — caminhos de código usam camposVeiculoSemPii na gravação", async () => {
  const root = new URL(".", import.meta.url);
  const files = [
    "gestao-cofre-upload.ts",
    "crlv-whatsapp.ts",
    "../gestao-cofre/index.ts",
  ];
  for (const name of files) {
    const source = await Deno.readTextFile(new URL(name, root));
    assertEquals(
      source.includes("camposVeiculoSemPii"),
      true,
      `${name} deve sanitizar campos_veiculo`,
    );
    assertEquals(
      source.includes("assertGestaoDocumentoCamposUpdateOk"),
      true,
      `${name} deve tratar falha de gravação`,
    );
  }
});
