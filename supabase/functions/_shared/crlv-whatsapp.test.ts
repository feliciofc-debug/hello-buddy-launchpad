import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseCrlvText } from "./crlv-parser.ts";
import {
  autoLinkCrlvToStock,
  crlvWhatsappActionButtons,
} from "./crlv-whatsapp.ts";
import { respostaCrlvWhatsApp } from "./documento-portao.ts";
import {
  CRLV_NAO_LIDO_MENSAGEM,
  relerCrlvDocumentoCofre,
} from "./gestao-cofre-upload.ts";

const OCR_TEXT = `
PLACA: LMC5764
RENAVAM: 12345678900
CHASSI: 9BWZZZ377VT004251
MARCA/MODELO/VERSAO: VOLKSWAGEN GOL CL 1.6
ANO FABRICACAO: 1998
ANO MODELO: 1999
COR: VERDE
COMBUSTIVEL: GASOLINA
CATEGORIA: PARTICULAR
MUNICIPIO/UF: SAO PAULO/SP
PROPRIETARIO: PESSOA EXEMPLO
CPF/CNPJ: 52998224725
`;

function updateChain(data: unknown = null) {
  const chain: Record<string, unknown> = { data, error: null };
  for (const method of ["eq", "is", "order", "limit"]) {
    chain[method] = () => chain;
  }
  return chain;
}

Deno.test({
  name: "VEIC-WPP-1 — Guardar e ler chama OCR local e grava CRLV como lido",
  permissions: { env: true },
  fn: async () => {
    const oldUrl = Deno.env.get("AMZ_OCR_URL");
    const oldToken = Deno.env.get("AMZ_OCR_TOKEN");
    const oldKey = Deno.env.get("DOC_COFRE_KEY");
    Deno.env.set("AMZ_OCR_URL", "http://127.0.0.1:3011/ocr");
    Deno.env.set("AMZ_OCR_TOKEN", "token-local");
    Deno.env.set(
      "DOC_COFRE_KEY",
      btoa(String.fromCharCode(...new Uint8Array(32))),
    );
    const updates: Record<string, unknown>[] = [];
    let calls = 0;
    const sb = {
      from(table: string) {
        if (table === "gestao_documento") {
          return {
            update(payload: Record<string, unknown>) {
              updates.push(payload);
              return updateChain();
            },
          };
        }
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      },
    };
    try {
      const result = await relerCrlvDocumentoCofre({
        sb: sb as never,
        userId: "u1",
        documentoId: "d1",
        bytes: new Uint8Array([1, 2, 3]),
        mime: "image/jpeg",
        fetchImpl: (() => {
          calls++;
          return Promise.resolve(
            new Response(JSON.stringify({ text: OCR_TEXT }), { status: 200 }),
          );
        }) as typeof fetch,
      });
      assertEquals(calls, 1);
      assertEquals(result.leitura?.veiculo.placa.valor, "LMC5764");
      assertEquals(updates[0]?.tipo, "crlv");
      assertEquals(updates[0]?.status, "lido");
    } finally {
      if (oldUrl == null) Deno.env.delete("AMZ_OCR_URL");
      else Deno.env.set("AMZ_OCR_URL", oldUrl);
      if (oldToken == null) Deno.env.delete("AMZ_OCR_TOKEN");
      else Deno.env.set("AMZ_OCR_TOKEN", oldToken);
      if (oldKey == null) Deno.env.delete("DOC_COFRE_KEY");
      else Deno.env.set("DOC_COFRE_KEY", oldKey);
    }
  },
});

Deno.test({
  name: "VEIC-WPP-1 — timeout do OCR mantém documento no cofre sem marcar lido",
  permissions: { env: true },
  fn: async () => {
    const oldUrl = Deno.env.get("AMZ_OCR_URL");
    const oldToken = Deno.env.get("AMZ_OCR_TOKEN");
    Deno.env.set("AMZ_OCR_URL", "http://127.0.0.1:3011/ocr");
    Deno.env.set("AMZ_OCR_TOKEN", "token-local");
    let updated = false;
    const sb = {
      from(table: string) {
        if (table === "gestao_documento") {
          return {
            update() {
              updated = true;
              return updateChain();
            },
          };
        }
        return { insert: () => Promise.resolve({ error: null }) };
      },
    };
    try {
      const result = await relerCrlvDocumentoCofre({
        sb: sb as never,
        userId: "u1",
        documentoId: "d1",
        bytes: new Uint8Array([1]),
        mime: "image/jpeg",
        fetchImpl: (() =>
          Promise.reject(
            new DOMException("The operation timed out", "TimeoutError"),
          )) as typeof fetch,
      });
      assertEquals(result.leitura, null);
      assertEquals(result.leituraErro, CRLV_NAO_LIDO_MENSAGEM);
      assertEquals(result.leituraReason, "ocr_timeout");
      assertEquals(updated, false);
    } finally {
      if (oldUrl == null) Deno.env.delete("AMZ_OCR_URL");
      else Deno.env.set("AMZ_OCR_URL", oldUrl);
      if (oldToken == null) Deno.env.delete("AMZ_OCR_TOKEN");
      else Deno.env.set("AMZ_OCR_TOKEN", oldToken);
    }
  },
});

Deno.test("VEIC-WPP-1 — placa antiga vincula estoque Mercosul e oferece desfazer", async () => {
  const updates: Record<string, unknown>[] = [];
  const sb = {
    from(table: string) {
      if (table === "veiculos_estoque") {
        return {
          select: () =>
            updateChain([{
              id: "v1",
              marca: "Volkswagen",
              modelo: "Gol",
              versao: "CL",
              placa: "LMC5H64",
            }]),
        };
      }
      if (table === "gestao_documento") {
        return {
          update(payload: Record<string, unknown>) {
            updates.push(payload);
            return updateChain();
          },
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    },
  };
  const linked = await autoLinkCrlvToStock(
    sb as never,
    "u1",
    "d1",
    parseCrlvText(OCR_TEXT, "ocr"),
  );
  assertEquals(linked, { id: "v1", label: "Volkswagen Gol CL" });
  assertEquals(updates[0], { veiculo_id: "v1" });
  const buttons = crlvWhatsappActionButtons("d1", "v1");
  assertEquals(buttons.buttons.map((button) => button.title), [
    "Salvar na plataforma",
    "Vistoria",
    "Desfazer vínculo",
  ]);
  assertStringIncludes(buttons.buttons[2].id, "cofre_doc_desvincular");
});

Deno.test("DOC-SEG-2 — resposta lista todos os campos e mascara CPF", () => {
  const reply = respostaCrlvWhatsApp(parseCrlvText(OCR_TEXT, "ocr"));
  for (const label of [
    "✅ CRLV lido",
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
  ]) {
    assertStringIncludes(reply, label);
  }
  assertEquals(reply.includes("52998224725"), false);
});
