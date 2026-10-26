import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DOCUMENTO_CLIENTE_RESPOSTA,
  isDocumentoGateCandidate,
  respostaCrlvWhatsApp,
  tipoDocumentoCofre,
  verificarDocumentoNoPortao,
} from "./documento-portao.ts";
import { parseCrlvText } from "./crlv-parser.ts";

const image = {
  kind: "image" as const,
  mime: "image/jpeg",
  base64: btoa("imagem sintetica"),
};

Deno.test("DOC-0 — portão reconhece imagens e PDFs, não áudio/vídeo", () => {
  assertEquals(isDocumentoGateCandidate(image), true);
  assertEquals(
    isDocumentoGateCandidate({
      kind: "document",
      mime: "application/pdf",
      base64: "AA==",
    }),
    true,
  );
  assertEquals(
    isDocumentoGateCandidate({
      kind: "video",
      mime: "video/mp4",
      base64: "AA==",
    }),
    false,
  );
});

Deno.test("DOC-0 — detector indisponível falha fechado", async () => {
  await assertRejects(
    () =>
      verificarDocumentoNoPortao(
        image,
        () => Promise.reject(new Error("indisponível")),
      ),
    Error,
    "indisponível",
  );
});

Deno.test("DOC-0 — resposta do CRLV nunca contém nome ou CPF completos", () => {
  const parsed = parseCrlvText(`
PLACA: ABC1D23
RENAVAM: 12345678900
CHASSI: 9BWZZZ377VT004251
MARCA/MODELO/VERSAO: MARCA / MODELO / VERSAO
ANO MODELO: 2023
NOME DO PROPRIETARIO: PESSOA SINTETICA COMPLETA
CPF/CNPJ: 529.982.247-25
OBSERVACOES: ALIENACAO FIDUCIARIA: BANCO SINTETICO
`);
  const reply = respostaCrlvWhatsApp(parsed);
  assertEquals(reply.includes("PESSOA SINTETICA COMPLETA"), false);
  assertEquals(reply.includes("529.982.247-25"), false);
  assertEquals(reply.includes("Pessoa"), true);
  assertEquals(reply.includes("***.***.247-**"), true);
});

Deno.test("DOC-0 — tipos do detector mapeiam para o cofre", () => {
  assertEquals(tipoDocumentoCofre("crlv", "application/pdf"), "crlv_e");
  assertEquals(tipoDocumentoCofre("crlv", "image/jpeg"), "crlv");
  assertEquals(tipoDocumentoCofre("cnh", "image/jpeg"), "cnh");
  assertEquals(tipoDocumentoCofre("rg", "image/jpeg"), "outro");
  assertEquals(
    DOCUMENTO_CLIENTE_RESPOSTA,
    "Recebi seu documento, vou repassar para a equipe com segurança.",
  );
});

Deno.test("DOC-0 — processor executa portão antes de qualquer rota de visão", async () => {
  const source = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const flow = source.slice(source.indexOf("// PASSO 6.7 — Baixa mídias"));
  const gate = flow.indexOf("const gateCandidates");
  assertEquals(gate >= 0, true);
  for (
    const externalRoute of [
      "tryProcessOsParceiroCotacaoWhatsAppShortcut",
      "classifyPhotoVertical",
      "processVitrineTrocaInboundPhoto",
      'fetch("https://ai.gateway.lovable.dev',
    ]
  ) {
    assertEquals(
      gate < flow.indexOf(externalRoute),
      true,
      `${externalRoute} aparece antes do portão`,
    );
  }
  assertEquals(
    flow.indexOf("DOCUMENTO_DETECTOR_INDISPONIVEL") <
      flow.indexOf("tryProcessOsParceiroCotacaoWhatsAppShortcut"),
    true,
  );
  assertEquals(
    flow.indexOf("document_secured: true") <
      flow.indexOf("tryProcessOsParceiroCotacaoWhatsAppShortcut"),
    true,
  );
});

Deno.test("DOC-0 — serviço separa detecção rápida da leitura completa", async () => {
  const source = await Deno.readTextFile(
    new URL("../../../services/amz-ocr/app.py", import.meta.url),
  );
  assertEquals(source.includes("_resize(image, 2400)"), true);
  assertEquals(source.includes("_resize(image, 1400)"), true);
  assertEquals(source.includes('config="--oem 1 --psm 11"'), true);
  assertEquals(source.includes("DETECT_TIMEOUT_SECONDS = 8"), true);
  assertEquals(source.includes("image_to_osd"), true);
  const endpoint = source.slice(source.indexOf('@app.post("/detectar")'));
  assertEquals(endpoint.includes('return {"documento": documento, "tipo": tipo}'), true);
  assertEquals(endpoint.includes('return {"text":'), false);
  const dockerfile = await Deno.readTextFile(
    new URL("../../../services/amz-ocr/Dockerfile", import.meta.url),
  );
  assertEquals(dockerfile.includes("COPY app.py detector.py ./"), true);
});
