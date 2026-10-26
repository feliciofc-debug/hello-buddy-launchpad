import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { lerCrlvLocal } from "./crlv-leitura.ts";

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
        new Response(JSON.stringify({ text: OCR_SINTETICO }), {
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
