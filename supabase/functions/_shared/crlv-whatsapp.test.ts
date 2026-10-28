import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseCrlvText } from "./crlv-parser.ts";
import {
  cifrarDadosPessoais,
  sha256Hex,
} from "./gestao-cofre-crypto.ts";
import {
  autoLinkCrlvToStock,
  completeCrlvWithMolicar,
  crlvWhatsappActionButtons,
} from "./crlv-whatsapp.ts";
import { respostaCrlvWhatsApp } from "./documento-portao.ts";
import {
  CRLV_NAO_LIDO_MENSAGEM,
  gestaoCofreUpload,
  relerCrlvDocumentoCofre,
} from "./gestao-cofre-upload.ts";
import { ProcessOneMemorySupabase } from "./process-one-test-harness.ts";

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
    const oldKey = Deno.env.get("DOC_COFRE_KEY");
    Deno.env.set("AMZ_OCR_URL", "http://127.0.0.1:3011/ocr");
    Deno.env.set("AMZ_OCR_TOKEN", "token-local");
    Deno.env.set(
      "DOC_COFRE_KEY",
      btoa(String.fromCharCode(...new Uint8Array(32).fill(2))),
    );
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
      if (oldKey == null) Deno.env.delete("DOC_COFRE_KEY");
      else Deno.env.set("DOC_COFRE_KEY", oldKey);
    }
  },
});

Deno.test({
  name: "VEIC-WPP-2 — uma placa válida já é leitura parcial aproveitável",
  permissions: { env: true },
  fn: async () => {
    const oldUrl = Deno.env.get("AMZ_OCR_URL");
    const oldToken = Deno.env.get("AMZ_OCR_TOKEN");
    const oldKey = Deno.env.get("DOC_COFRE_KEY");
    Deno.env.set("AMZ_OCR_URL", "http://127.0.0.1:3011/ocr");
    Deno.env.set("AMZ_OCR_TOKEN", "token-local");
    Deno.env.set(
      "DOC_COFRE_KEY",
      btoa(String.fromCharCode(...new Uint8Array(32).fill(2))),
    );
    const updates: Record<string, unknown>[] = [];
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
          Promise.resolve(
            new Response(JSON.stringify({
              text: "PLACA\nABC1234",
              metrics: {
                motor: "paddleocr",
                variante_vencedora: "pagina_cor",
                tempo_ms: 28_785,
                n_campos_validos: 1,
              },
            })),
          )) as typeof fetch,
      });
      assertEquals(result.leitura?.veiculo.placa.valor, "ABC1234");
      assertEquals(result.leitura?.leitura_fraca, true);
      assertEquals(result.leituraErro, null);
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
  name: "VEIC-WPP-2 — sem placa pede uma nova foto",
  permissions: { env: true },
  fn: async () => {
    const oldUrl = Deno.env.get("AMZ_OCR_URL");
    const oldToken = Deno.env.get("AMZ_OCR_TOKEN");
    Deno.env.set("AMZ_OCR_URL", "http://127.0.0.1:3011/ocr");
    Deno.env.set("AMZ_OCR_TOKEN", "token-local");
    const sb = {
      from() {
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
          Promise.resolve(
            new Response(JSON.stringify({
              text: "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO",
            })),
          )) as typeof fetch,
      });
      assertEquals(result.leitura, null);
      assertEquals(result.leituraErro, CRLV_NAO_LIDO_MENSAGEM);
    } finally {
      if (oldUrl == null) Deno.env.delete("AMZ_OCR_URL");
      else Deno.env.set("AMZ_OCR_URL", oldUrl);
      if (oldToken == null) Deno.env.delete("AMZ_OCR_TOKEN");
      else Deno.env.set("AMZ_OCR_TOKEN", oldToken);
    }
  },
});

Deno.test({
  name: "VEIC-WPP-2 — arquivo repetido com falha anterior roda OCR novamente",
  permissions: { env: true },
  fn: async () => {
    const bytes = new Uint8Array([7, 7, 7]);
    const sha256 = await sha256Hex(bytes);
    const oldUrl = Deno.env.get("AMZ_OCR_URL");
    const oldToken = Deno.env.get("AMZ_OCR_TOKEN");
    const oldKey = Deno.env.get("DOC_COFRE_KEY");
    const oldFetch = globalThis.fetch;
    Deno.env.set("AMZ_OCR_URL", "http://127.0.0.1:3011/ocr");
    Deno.env.set("AMZ_OCR_TOKEN", "token-local");
    Deno.env.set(
      "DOC_COFRE_KEY",
      btoa(String.fromCharCode(...new Uint8Array(32).fill(3))),
    );
    let ocrCalls = 0;
    globalThis.fetch = (() => {
      ocrCalls++;
      return Promise.resolve(
        new Response(JSON.stringify({ text: "PLACA\nABC1234" })),
      );
    }) as typeof fetch;
    const db = new ProcessOneMemorySupabase({
      gestao_documento: [{
        id: "00000000-0000-4000-8000-000000000001",
        user_id: "11111111-1111-4111-8111-111111111111",
        sha256,
        status: "recebido",
        deleted_at: null,
      }],
      gestao_documento_acesso: [],
    });
    try {
      const result = await gestaoCofreUpload({
        sb: db as never,
        userId: "11111111-1111-4111-8111-111111111111",
        bytes,
        mime: "image/jpeg",
        tipo: "crlv",
        origem: "whatsapp",
        lerCrlv: true,
      });
      assertEquals(result.duplicate, true);
      assertEquals(result.reusedSuccessfulRead, false);
      assertEquals(result.leitura?.veiculo.placa.valor, "ABC1234");
      assertEquals(ocrCalls, 1);
      assertEquals(db.tables.gestao_documento[0].status, "lido");
    } finally {
      globalThis.fetch = oldFetch;
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
  name: "VEIC-WPP-2 — arquivo repetido reaproveita somente leitura bem-sucedida",
  permissions: { env: true },
  fn: async () => {
    const bytes = new Uint8Array([8, 8, 8]);
    const sha256 = await sha256Hex(bytes);
    const oldKey = Deno.env.get("DOC_COFRE_KEY");
    const oldFetch = globalThis.fetch;
    Deno.env.set(
      "DOC_COFRE_KEY",
      btoa(String.fromCharCode(...new Uint8Array(32).fill(4))),
    );
    const parsed = parseCrlvText(OCR_TEXT, "ocr");
    globalThis.fetch = (() => {
      throw new Error("OCR não deve rodar para leitura bem-sucedida");
    }) as typeof fetch;
    const db = new ProcessOneMemorySupabase({
      gestao_documento: [{
        id: "00000000-0000-4000-8000-000000000002",
        user_id: "11111111-1111-4111-8111-111111111111",
        sha256,
        status: "lido",
        campos_veiculo: {
          veiculo: parsed.veiculo,
          documento: parsed.documento,
          observacoes: parsed.observacoes,
        },
        dados_pessoais_cifrados: await cifrarDadosPessoais({
          nome: parsed.proprietario.nome.valor,
          cpf_cnpj: parsed.proprietario.cpf_cnpj.valor,
        }),
        deleted_at: null,
      }],
      gestao_documento_acesso: [],
    });
    try {
      const result = await gestaoCofreUpload({
        sb: db as never,
        userId: "11111111-1111-4111-8111-111111111111",
        bytes,
        mime: "image/jpeg",
        tipo: "crlv",
        origem: "whatsapp",
        lerCrlv: true,
      });
      assertEquals(result.duplicate, true);
      assertEquals(result.reusedSuccessfulRead, true);
      assertEquals(result.leitura?.veiculo.placa.valor, "LMC5764");
      assertEquals(
        result.leitura?.proprietario.cpf_cnpj.valor,
        "52998224725",
      );
    } finally {
      globalThis.fetch = oldFetch;
      if (oldKey == null) Deno.env.delete("DOC_COFRE_KEY");
      else Deno.env.set("DOC_COFRE_KEY", oldKey);
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
  const buttons = crlvWhatsappActionButtons("d1", "v1", "LMC5764");
  assertEquals(buttons.buttons.map((button) => button.title), [
    "Salvar na plataforma",
    "Desfazer vínculo",
    "Consultar segurança",
  ]);
  assertStringIncludes(buttons.buttons[1].id, "cofre_doc_desvincular");
  assertEquals(buttons.buttons[2].id, "molicar_wa:procedencia:LMC5764");
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

Deno.test("VEIC-WPP-2 — placa parcial é completada pela Molicar e mantém origens", async () => {
  const updates: Record<string, unknown>[] = [];
  const audits: Record<string, unknown>[] = [];
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
        insert(payload: Record<string, unknown>) {
          audits.push(payload);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  const partial = parseCrlvText(
    "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO\nPLACA: ABC1234",
    "ocr",
  );
  assertEquals(partial.leitura_fraca, true);
  const completed = await completeCrlvWithMolicar({
    sb: sb as never,
    userId: "u1",
    documentoId: "d1",
    leitura: partial,
    runConsulta: async () => ({
      not_found: false,
      vin: "9BWZZZ377VT004251",
      renavam: "12345678900",
      dados: {
        marca: "TOYOTA",
        modelo: "COROLLA",
        versao: "ALTISFLEX",
        ano_fabricacao: 2014,
        ano_modelo: 2015,
        combustivel: "FLEX",
        cor: "PRATA",
      },
    }) as never,
  });
  assertEquals(completed.completado, true);
  assertEquals(completed.leitura.veiculo.placa.valor, "ABC1234");
  assertEquals(
    completed.leitura.veiculo.marca_modelo_versao.valor,
    "TOYOTA COROLLA ALTISFLEX",
  );
  assertEquals(completed.leitura.veiculo.chassi.valor, "9BWZZZ377VT004251");
  assertEquals(completed.leitura.veiculo.renavam.valor, "12345678900");
  assertEquals(completed.origens.veiculo.placa, "documento");
  assertEquals(completed.origens.veiculo.chassi, "Molicar");
  assertEquals(
    (updates[0].campos_veiculo as Record<string, unknown>).origens,
    completed.origens,
  );
  assertEquals(JSON.stringify(audits).includes("9BWZZZ377VT004251"), false);

  const reply = respostaCrlvWhatsApp(completed.leitura, {
    origens: completed.origens,
    leituraParcial: true,
    completadoMolicar: true,
  });
  assertStringIncludes(
    reply,
    "✅ Li a placa ABC1234 no documento e completei pela Molicar:",
  );
  assertStringIncludes(reply, "ABC1234 (origem: documento)");
  assertStringIncludes(reply, "TOYOTA COROLLA ALTISFLEX (origem: Molicar)");
});

Deno.test("VEIC-WPP-2 — Molicar indisponível preserva leitura parcial", async () => {
  const sb = {
    from(table: string) {
      if (table === "gestao_documento") {
        return { update: () => updateChain() };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    },
  };
  const partial = parseCrlvText("PLACA: ABC1234", "ocr");
  const completed = await completeCrlvWithMolicar({
    sb: sb as never,
    userId: "u1",
    documentoId: "d1",
    leitura: partial,
    runConsulta: async () => {
      throw new Error("Conecte a Molicar antes de consultar.");
    },
  });
  assertEquals(completed.completado, false);
  assertEquals(completed.leitura.veiculo.placa.valor, "ABC1234");
  assertStringIncludes(completed.aviso ?? "", "não está conectada");
  const reply = respostaCrlvWhatsApp(completed.leitura, {
    origens: completed.origens,
    leituraParcial: true,
    avisoMolicar: completed.aviso,
  });
  assertStringIncludes(reply, "✅ Li a placa ABC1234 no documento.");
  assertStringIncludes(reply, "⚠️ A Molicar não está conectada");
});
