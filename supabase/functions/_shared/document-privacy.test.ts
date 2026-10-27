import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  commentOnLocallyExtractedDocument,
  maskSensitiveDocumentText,
  prepareDocumentTextForExternalAi,
} from "./document-privacy.ts";

const RAW_PII = {
  cpf: "529.982.247-25",
  cnpj: "04.252.011/0001-10",
  rg: "12.345.678-9",
  cnh: "01234567890",
  renavam: "12345678901",
  chassi: "9BWZZZ377VT004251",
  placa: "ABC1D23",
  telefone: "(11) 98765-4321",
  email: "pessoa@example.com",
  cep: "01310-100",
  endereco: "Avenida Paulista, 1000",
};

Deno.test("PRIV-1 — máscara remove todos os identificadores documentais", () => {
  const masked = maskSensitiveDocumentText([
    `CPF: ${RAW_PII.cpf}`,
    `CNPJ: ${RAW_PII.cnpj}`,
    `RG: ${RAW_PII.rg}`,
    `CNH: ${RAW_PII.cnh}`,
    `RENAVAM: ${RAW_PII.renavam}`,
    `CHASSI: ${RAW_PII.chassi}`,
    `PLACA: ${RAW_PII.placa}`,
    `Telefone: ${RAW_PII.telefone}`,
    `E-mail: ${RAW_PII.email}`,
    `CEP: ${RAW_PII.cep}`,
    RAW_PII.endereco,
    "Objeto do contrato: compra e venda do veículo.",
  ].join("\n"));

  for (const raw of Object.values(RAW_PII)) {
    assertEquals(masked.includes(raw), false, `PII não mascarada: ${raw}`);
  }
  assertStringIncludes(masked, "[CPF/CNPJ]");
  assertStringIncludes(masked, "[PLACA]");
  assertStringIncludes(masked, "[CHASSI]");
  assertStringIncludes(masked, "[ENDEREÇO]");
  assertStringIncludes(masked, "Objeto do contrato");
});

Deno.test("PRIV-1 — PDF/CNH/RG/comprovante de cliente nunca chama gateway externo", async () => {
  let calls = 0;
  for (
    const [filename, text] of [
      ["cadastro.pdf", `CPF ${RAW_PII.cpf}`],
      ["cnh.jpg", "CARTEIRA NACIONAL DE HABILITACAO"],
      ["rg.png", "CARTEIRA DE IDENTIDADE"],
      ["comprovante.pdf", `Conta de energia\n${RAW_PII.endereco}`],
    ]
  ) {
    const result = await commentOnLocallyExtractedDocument({
      audience: "client",
      text,
      filename,
      kind: filename.split(".").pop() || "arquivo",
      apiKey: "test",
      model: "test",
      fetchFn: (() => {
        calls++;
        throw new Error("gateway não pode receber documento de cliente");
      }) as typeof fetch,
    });
    assertEquals(result, { sent: false, reason: "client_document" });
  }
  assertEquals(calls, 0);
});

Deno.test("PRIV-1 — classificador local bloqueia identidade antes do gateway", async () => {
  let calls = 0;
  const result = await commentOnLocallyExtractedDocument({
    audience: "gestao",
    text:
      `CARTEIRA NACIONAL DE HABILITACAO\nREPUBLICA FEDERATIVA DO BRASIL\nCPF ${RAW_PII.cpf}`,
    filename: "cnh.pdf",
    kind: "pdf",
    apiKey: "test",
    model: "test",
    fetchFn: (() => {
      calls++;
      throw new Error("gateway não pode receber identidade");
    }) as typeof fetch,
  });
  assertEquals(result, { sent: false, reason: "identity_document" });
  assertEquals(calls, 0);
});

Deno.test("PRIV-1 — contrato do responsável envia somente texto mascarado", async () => {
  let payload = "";
  const result = await commentOnLocallyExtractedDocument({
    audience: "gestao",
    text: [
      "CONTRATO DE COMPRA E VENDA",
      `Comprador CPF ${RAW_PII.cpf}`,
      `Veículo placa ${RAW_PII.placa}`,
      `RENAVAM ${RAW_PII.renavam}`,
      `Chassi ${RAW_PII.chassi}`,
      `Contato ${RAW_PII.telefone} ${RAW_PII.email}`,
      `CEP ${RAW_PII.cep}`,
      RAW_PII.endereco,
      "Valor total R$ 90.000,00.",
    ].join("\n"),
    filename: `contrato-${RAW_PII.placa}.pdf`,
    context: `Resuma o contrato da placa ${RAW_PII.placa}`,
    kind: "pdf",
    apiKey: "test",
    model: "test",
    fetchFn: (async (_url, init) => {
      payload = String(init?.body || "");
      if (
        /data:[^;,]+;base64,/i.test(payload) ||
        /file_data|image_url|inline_data/i.test(payload)
      ) {
        throw new Error("gateway recebeu bytes de documento");
      }
      for (const raw of Object.values(RAW_PII)) {
        if (payload.includes(raw)) {
          throw new Error(`gateway recebeu PII: ${raw}`);
        }
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Comentário seguro." } }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch,
  });

  assert(result.sent);
  assertEquals(result.reply, "Comentário seguro.");
  assertStringIncludes(payload, "[CPF/CNPJ]");
  assertStringIncludes(payload, "[PLACA]");
  assertStringIncludes(payload, "Valor total R$ 90.000,00.");
});

Deno.test("PRIV-1 — conteúdo só de PII fica no cofre sem chamada externa", () => {
  assertEquals(
    prepareDocumentTextForExternalAi({
      audience: "gestao",
      text: `${RAW_PII.cpf}\n${RAW_PII.email}\n${RAW_PII.endereco}`,
    }),
    { allowed: false, reason: "empty_after_masking" },
  );
});

Deno.test("PRIV-1 — processor guarda documento de cliente e retorna antes de IA", async () => {
  const source = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const start = source.indexOf(
    "if (docMedia.length > 0 && senderIsClient)",
  );
  const end = source.indexOf("if (docMedia.length > 0)", start + 1);
  const clientFlow = source.slice(start, end);
  assert(start >= 0 && end > start);
  assertStringIncludes(clientFlow, "gestaoCofreUpload");
  assertStringIncludes(clientFlow, 'tipo: "outro"');
  assertStringIncludes(clientFlow, "DOCUMENTO_CLIENTE_RESPOSTA");
  assertStringIncludes(clientFlow, "client_document_secured");
  assertEquals(clientFlow.includes("ai.gateway.lovable.dev"), false);
  assertEquals(clientFlow.includes("MODEL_DEEP"), false);

  const ownerFlow = source.slice(
    end,
    source.indexOf("// PASSO 6.9", end),
  );
  assertStringIncludes(ownerFlow, "gestaoCofreUpload");
  assertStringIncludes(ownerFlow, "commentOnLocallyExtractedDocument");
  assertEquals(ownerFlow.includes("file_data"), false);
  assertEquals(ownerFlow.includes("image_url"), false);
});

Deno.test("PRIV-1.1 — orçamento de parceiro usa OCR local sem fallback externo", async () => {
  const source = await Deno.readTextFile(
    new URL("./os-parceiro-orcamento-media.ts", import.meta.url),
  );
  assertStringIncludes(source, "extractDocumentText");
  assertStringIncludes(source, "extrairTextoOcrLocal");
  assertStringIncludes(source, "classificarTextoDocumentoProtegido");
  assertStringIncludes(source, "documentoProtegido: true");
  assertEquals(source.includes("ai.gateway.lovable.dev"), false);
  assertEquals(source.includes("image_url"), false);
  assertEquals(source.includes("file_data"), false);
});
