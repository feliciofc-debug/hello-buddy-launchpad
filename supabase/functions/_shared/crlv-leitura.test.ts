import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectarDocumentoLocal, lerCrlvLocal } from "./crlv-leitura.ts";

const OCR_SINTETICO = `
PLACA: ABC1D23
RENAVAM: 12345678900
CHASSI: 9BWZZZ377VT004251
MARCA/MODELO/VERSAO: MARCA / MODELO / VERSAO
ANO MODELO: 2023
`;

Deno.test({
  name: "DOC-1 — imagem usa somente OCR local com token",
  permissions: { env: true },
  fn: async () => {
    const oldUrl = Deno.env.get("AMZ_OCR_URL");
    const oldToken = Deno.env.get("AMZ_OCR_TOKEN");
    Deno.env.set("AMZ_OCR_URL", "http://127.0.0.1:3011/ocr");
    Deno.env.set("AMZ_OCR_TOKEN", "token-sintetico");
    let calls = 0;
    const fetchMock = ((
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls++;
      assertEquals(String(input), "http://127.0.0.1:3011/ocr");
      assertEquals(
        new Headers(init?.headers).get("X-OCR-Token"),
        "token-sintetico",
      );
      assertEquals(
        new Headers(init?.headers).get("Content-Type"),
        "image/jpeg",
      );
      return Promise.resolve(
        new Response(JSON.stringify({
          text: OCR_SINTETICO,
          metrics: {
            motor: "paddleocr",
            variante_vencedora: "perspectiva_sem_fundo",
            tempo_ms: 4321,
            n_campos_validos: 3,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as typeof fetch;
    try {
      const result = await lerCrlvLocal(
        new Uint8Array([1, 2, 3]),
        "image/jpeg",
        "sintetico.jpg",
        fetchMock,
      );
      assertEquals(calls, 1);
      assertEquals(result.metodo, "ocr_local");
      assertEquals(result.parser.veiculo.placa.valor, "ABC1D23");
      assertEquals(result.metricas_ocr, {
        motor: "paddleocr",
        variante_vencedora: "perspectiva_sem_fundo",
        tempo_ms: 4321,
        n_campos_validos: 3,
      });
    } finally {
      if (oldUrl == null) Deno.env.delete("AMZ_OCR_URL");
      else Deno.env.set("AMZ_OCR_URL", oldUrl);
      if (oldToken == null) Deno.env.delete("AMZ_OCR_TOKEN");
      else Deno.env.set("AMZ_OCR_TOKEN", oldToken);
    }
  },
});

Deno.test({
  name: "DOC-1.2 — métricas recusam variante livre antes da auditoria",
  permissions: { env: true },
  fn: async () => {
    const oldUrl = Deno.env.get("AMZ_OCR_URL");
    const oldToken = Deno.env.get("AMZ_OCR_TOKEN");
    Deno.env.set("AMZ_OCR_URL", "http://127.0.0.1:3011/ocr");
    Deno.env.set("AMZ_OCR_TOKEN", "token-sintetico");
    try {
      const result = await lerCrlvLocal(
        new Uint8Array([1]),
        "image/jpeg",
        "metrica-sintetica.jpg",
        (() =>
          Promise.resolve(
            new Response(JSON.stringify({
              text: OCR_SINTETICO,
              metrics: {
                motor: "paddleocr",
                variante_vencedora: "PLACA ABC1D23",
                tempo_ms: 10,
                n_campos_validos: 3,
              },
            })),
          )) as typeof fetch,
      );
      assertEquals(result.metricas_ocr, null);
    } finally {
      if (oldUrl == null) Deno.env.delete("AMZ_OCR_URL");
      else Deno.env.set("AMZ_OCR_URL", oldUrl);
      if (oldToken == null) Deno.env.delete("AMZ_OCR_TOKEN");
      else Deno.env.set("AMZ_OCR_TOKEN", oldToken);
    }
  },
});

Deno.test({
  name: "DOC-1.2 — OCR vazio abre conferência para digitação manual",
  permissions: { env: true },
  fn: async () => {
    const oldUrl = Deno.env.get("AMZ_OCR_URL");
    const oldToken = Deno.env.get("AMZ_OCR_TOKEN");
    Deno.env.set("AMZ_OCR_URL", "http://127.0.0.1:3011/ocr");
    Deno.env.set("AMZ_OCR_TOKEN", "token-sintetico");
    try {
      const result = await lerCrlvLocal(
        new Uint8Array([1]),
        "image/jpeg",
        "vazio-sintetico.jpg",
        (() =>
          Promise.resolve(
            new Response(JSON.stringify({
              text: "",
              metrics: {
                motor: "tesseract",
                variante_vencedora: "pagina_clahe",
                tempo_ms: 25000,
                n_campos_validos: 0,
              },
            })),
          )) as typeof fetch,
      );
      assertEquals(result.parser.leitura_fraca, true);
      assertEquals(result.parser.veiculo.placa.valor, null);
      assertEquals(result.metricas_ocr?.n_campos_validos, 0);
    } finally {
      if (oldUrl == null) Deno.env.delete("AMZ_OCR_URL");
      else Deno.env.set("AMZ_OCR_URL", oldUrl);
      if (oldToken == null) Deno.env.delete("AMZ_OCR_TOKEN");
      else Deno.env.set("AMZ_OCR_TOKEN", oldToken);
    }
  },
});

Deno.test({
  name: "DOC-1 — OCR local ausente recusa leitura da imagem",
  permissions: { env: true },
  fn: async () => {
    const oldUrl = Deno.env.get("AMZ_OCR_URL");
    const oldToken = Deno.env.get("AMZ_OCR_TOKEN");
    Deno.env.delete("AMZ_OCR_URL");
    Deno.env.delete("AMZ_OCR_TOKEN");
    try {
      await assertRejects(
        () =>
          lerCrlvLocal(
            new Uint8Array([1]),
            "image/png",
            "sintetico.png",
            (() => {
              throw new Error("não deve chamar fetch");
            }) as typeof fetch,
          ),
        Error,
        "OCR local não configurado",
      );
    } finally {
      if (oldUrl != null) Deno.env.set("AMZ_OCR_URL", oldUrl);
      if (oldToken != null) Deno.env.set("AMZ_OCR_TOKEN", oldToken);
    }
  },
});

Deno.test("DOC-1 — PDF tenta texto interno antes do OCR", async () => {
  const source = await Deno.readTextFile(
    new URL("./crlv-leitura.ts", import.meta.url),
  );
  const flow = source.slice(
    source.indexOf("export async function lerCrlvLocal"),
  );
  assertEquals(
    flow.indexOf("extractDocumentText(") < flow.indexOf("ocrLocal("),
    true,
  );
});

Deno.test({
  name: "DOC-0 — portão rápido usa /detectar e não recebe texto",
  permissions: { env: true },
  fn: async () => {
    const oldUrl = Deno.env.get("AMZ_OCR_URL");
    const oldToken = Deno.env.get("AMZ_OCR_TOKEN");
    Deno.env.set("AMZ_OCR_URL", "http://127.0.0.1:3011/ocr");
    Deno.env.set("AMZ_OCR_TOKEN", "token-sintetico");
    const fetchMock = ((input: string | URL | Request, init?: RequestInit) => {
      assertEquals(String(input), "http://127.0.0.1:3011/detectar");
      assertEquals(
        new Headers(init?.headers).get("X-OCR-Token"),
        "token-sintetico",
      );
      return Promise.resolve(
        new Response(JSON.stringify({ documento: true, tipo: "crlv" }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as typeof fetch;
    try {
      assertEquals(
        await detectarDocumentoLocal(
          new Uint8Array([1]),
          "image/jpeg",
          fetchMock,
        ),
        { documento: true, possivel_documento: false, tipo: "crlv" },
      );
    } finally {
      if (oldUrl == null) Deno.env.delete("AMZ_OCR_URL");
      else Deno.env.set("AMZ_OCR_URL", oldUrl);
      if (oldToken == null) Deno.env.delete("AMZ_OCR_TOKEN");
      else Deno.env.set("AMZ_OCR_TOKEN", oldToken);
    }
  },
});
