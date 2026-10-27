import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  deveBloquearDocumentoParceiro,
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

Deno.test("DOC-0.1 — PDF com texto é classificado localmente sem OCR", async () => {
  const pdf = {
    kind: "document" as const,
    mime: "application/pdf",
    filename: "orcamento.pdf",
    base64: btoa("pdf sintetico"),
  };
  let detectorCalls = 0;
  const detector = () => {
    detectorCalls++;
    return Promise.resolve({
      documento: true,
      possivel_documento: false,
      tipo: "crlv" as const,
    });
  };
  const extracted = (text: string) => () =>
    Promise.resolve({
      supported: true,
      text,
      truncated: false,
      kind: "pdf",
    });
  const budget = await verificarDocumentoNoPortao(
    pdf,
    detector,
    extracted(
      "ORCAMENTO FUNILARIA CNPJ 04.252.011/0001-10 TELEFONE 11 98765-4321",
    ),
  );
  assertEquals(budget.documento, false);
  assertEquals(detectorCalls, 0);

  const crlv = await verificarDocumentoNoPortao(
    pdf,
    detector,
    extracted("CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO"),
  );
  assertEquals(crlv.documento, true);
  assertEquals(crlv.tipo, "crlv");
  assertEquals(detectorCalls, 0);
});

Deno.test("DOC-0.1 — PDF sem texto usa detector visual uma vez", async () => {
  const pdf = {
    kind: "document" as const,
    mime: "application/pdf",
    filename: "scan.pdf",
    base64: btoa("pdf sintetico"),
  };
  let detectorCalls = 0;
  const result = await verificarDocumentoNoPortao(
    pdf,
    () => {
      detectorCalls++;
      return Promise.resolve({
        documento: false,
        possivel_documento: false,
        tipo: null,
      });
    },
    () =>
      Promise.resolve({
        supported: true,
        text: "",
        truncated: false,
        kind: "pdf",
      }),
  );
  assertEquals(result.documento, false);
  assertEquals(result.possivel_documento, false);
  assertEquals(detectorCalls, 1);
});

Deno.test("DOC-0.2 — possível documento permanece bloqueado para IA", async () => {
  const result = await verificarDocumentoNoPortao(
    image,
    () =>
      Promise.resolve({
        documento: false,
        possivel_documento: true,
        tipo: null,
      }),
  );
  assertEquals(result.documento, false);
  assertEquals(result.possivel_documento, true);
});

Deno.test("VEIC-WPP-1 — resposta completa do CRLV mascara somente CPF/CNPJ", () => {
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
  assertEquals(
    reply.startsWith("✅ CRLV lido"),
    true,
  );
  assertEquals(reply.includes("PESSOA SINTETICA COMPLETA"), true);
  assertEquals(reply.includes("529.982.247-25"), false);
  assertEquals(reply.includes("***.982.247-**"), true);
  for (
    const label of [
      "Placa:",
      "Renavam:",
      "Chassi:",
      "Marca/modelo/versão:",
      "Ano fabricação/modelo:",
      "Cor:",
      "Combustível:",
      "Categoria:",
      "Município/UF:",
      "Proprietário:",
      "CPF/CNPJ:",
    ]
  ) assertEquals(reply.includes(`\n${label}`), true);
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

Deno.test("DOC-0.1 — parceiro roda antes do portão geral e continua protegido", async () => {
  assertEquals(
    deveBloquearDocumentoParceiro({
      documento: false,
      possivel_documento: true,
    }),
    false,
  );
  assertEquals(
    deveBloquearDocumentoParceiro({
      documento: true,
      possivel_documento: false,
    }),
    true,
  );
  const source = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const flow = source.slice(source.indexOf("// PASSO 6.7 — Baixa mídias"));
  const gate = flow.indexOf("const gateCandidates");
  const partner = flow.indexOf("tryProcessOsParceiroCotacaoWhatsAppShortcut");
  assertEquals(gate >= 0, true);
  assertEquals(partner > gate, true);
  assertEquals(
    flow.indexOf("isProtectedDocument: async") > partner,
    true,
  );
  assertEquals(
    flow.indexOf("deveBloquearDocumentoParceiro(checked)") > partner,
    true,
  );
  assertEquals(
    flow.includes("partnerChecked?.possivel_documento ? partnerChecked : null"),
    false,
  );
  assertEquals(
    flow.includes("partnerChecked?.documento || partnerOcrProtected"),
    true,
  );
  const generalGate = flow.indexOf(
    "// DOC-0 — portão local ANTES das demais rotas",
  );
  assertEquals(partner < generalGate, true);
  for (
    const externalRoute of [
      "classifyPhotoVertical",
      "processVitrineTrocaInboundPhoto",
      "const aiResult = await callGemini(",
    ]
  ) {
    assertEquals(
      gate < flow.indexOf(externalRoute),
      true,
      `${externalRoute} aparece antes do portão`,
    );
  }
  assertEquals(
    flow.indexOf("DOCUMENTO_DETECTOR_INDISPONIVEL") > generalGate,
    true,
  );
  assertEquals(
    flow.indexOf("document_secured: true") > generalGate,
    true,
  );
});

Deno.test("DOC-0 — serviço separa detecção rápida da leitura completa", async () => {
  const source = await Deno.readTextFile(
    new URL("../../../services/amz-ocr/app.py", import.meta.url),
  );
  const fullOcr = await Deno.readTextFile(
    new URL("../../../services/amz-ocr/ocr_engine.py", import.meta.url),
  );
  assertEquals(fullOcr.includes("_resize_max(rgb, 1600)"), true);
  assertEquals(source.includes("_resize(image, 1400)"), true);
  assertEquals(source.includes('config="--oem 1 --psm 11"'), true);
  assertEquals(source.includes("DETECT_TIMEOUT_SECONDS = 4"), true);
  assertEquals(source.includes("image_to_osd"), true);
  assertEquals(source.includes("oriented.rotate(90"), true);
  assertEquals(source.includes("ImageOps.autocontrast"), true);
  assertEquals(fullOcr.includes("use_doc_orientation_classify=full_document"), true);
  assertEquals(fullOcr.includes("use_doc_unwarping=full_document"), true);
  assertEquals(fullOcr.includes("use_textline_orientation=full_document"), true);
  assertEquals(
    source.includes("_pil_images(raw, content_type, first_page_only=True)"),
    true,
  );
  const endpoint = source.slice(source.indexOf('@app.post("/detectar")'));
  assertEquals(
    endpoint.includes('"possivel_documento": possivel'),
    true,
  );
  assertEquals(endpoint.includes('return {"text":'), false);
  const dockerfile = await Deno.readTextFile(
    new URL("../../../services/amz-ocr/Dockerfile", import.meta.url),
  );
  assertEquals(
    dockerfile.includes("COPY app.py detector.py ocr_engine.py"),
    true,
  );
});

Deno.test("DOC-0.2 — portão pede confirmação e só libera no botão negativo", async () => {
  const source = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const flow = source.slice(source.indexOf("// PASSO 6.7 — Baixa mídias"));
  const possibleGate = flow.indexOf("if (possibleDocument)");
  const externalAi = flow.indexOf("const aiResult = await callGemini(");
  assertEquals(possibleGate >= 0, true);
  assertEquals(possibleGate < externalAi, true);
  assertEquals(source.includes("Guardar e ler"), true);
  assertEquals(source.includes("Não é documento"), true);
  assertEquals(source.includes("releasedPossibleDocument"), true);
});

Deno.test("ESTAB-1 — botões do cofre usam o ID bruto e Guardar e ler não cai na IA", async () => {
  const source = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  assertEquals(
    source.includes(
      "const interactiveId = extractWhatsAppInteractiveId(row.payload);",
    ),
    true,
  );
  const possibleStart = source.indexOf(
    "const possibleAction = String(interactiveId ?? \"\").match(",
  );
  const documentActions = source.indexOf(
    "// DOC-0 — ações dos botões enviados após guardar um CRLV no cofre.",
  );
  const possibleFlow = source.slice(possibleStart, documentActions);
  assertEquals(possibleStart >= 0, true);
  assertEquals(possibleFlow.includes("relerCrlvDocumentoCofre"), true);
  assertEquals(
    possibleFlow.includes("CRLV_NAO_LIDO_MENSAGEM"),
    true,
  );
  assertEquals(possibleFlow.includes("await doneQueue(row.id)"), true);
  assertEquals(possibleFlow.includes("callGemini("), false);
  assertEquals(
    source.includes(
      '/^cofre_doc_(?:salvar|vistoria|cadastrar|vincular|guardar|link|troca|desvincular):/i',
    ),
    true,
  );
});

Deno.test("VEIC-WPP-1 — Guardar e ler encerra o turno sem cair na IA genérica", async () => {
  const source = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const action = source.slice(
    source.indexOf("const possibleAction"),
    source.indexOf("// DOC-0 — ações dos botões"),
  );
  assertEquals(action.includes("relerCrlvDocumentoCofre"), true);
  assertEquals(action.includes("CRLV_NAO_LIDO_MENSAGEM"), true);
  assertEquals(action.includes("callGemini"), false);
  assertEquals(action.includes("crlv_read: false"), true);
  assertEquals(
    action.includes('String(interactiveId ?? "").match'),
    true,
  );
});

Deno.test("PRIV-1 — documento certo ou possível recebe marca de proteção", async () => {
  for (const key of ["documento", "possivel_documento"] as const) {
    const candidate = { ...image };
    const result = await verificarDocumentoNoPortao(
      candidate,
      () =>
        Promise.resolve({
          documento: key === "documento",
          possivel_documento: key === "possivel_documento",
          tipo: key === "documento" ? "cnh" as const : null,
        }),
    );
    assertEquals(result.media.protected_document, true);
  }
});

Deno.test("PRIV-1 — mídia protegida tem barreiras antes de toda visão tardia", async () => {
  const source = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  assertEquals(
    source.includes(
      "media = media.filter((item) => !isProtectedDocumentMedia(item))",
    ),
    true,
  );
  assertEquals(
    source.includes(
      '!isProtectedDocumentMedia(m) &&\n      (m.kind === "image" || m.kind === "video")',
    ),
    true,
  );
  assertEquals(
    source.includes(
      "const externalAiMedia = media.filter((item) =>\n      !isProtectedDocumentMedia(item)",
    ),
    true,
  );
});
