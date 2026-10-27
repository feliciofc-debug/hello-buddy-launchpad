import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ORCAMENTO_MEDIA_VALOR_NAO_LIDO,
  parseOrcamentoFromExtractedText,
  textoDeOrcamentoParceiroMedia,
} from "./os-parceiro-orcamento-media.ts";
import {
  tryProcessOsParceiroCotacaoWhatsAppInbound,
} from "./os-parceiro-inbound.ts";
import type { MediaExtract } from "./whatsapp-media.ts";

const OCR_URL = "http://127.0.0.1:3011/ocr";

function media(
  kind: MediaExtract["kind"],
  mime: string,
  filename?: string,
): MediaExtract {
  return {
    kind,
    mime,
    filename,
    base64: btoa("arquivo sintetico"),
  };
}

async function withOcrEnv(fn: () => Promise<void>): Promise<void> {
  const oldUrl = Deno.env.get("AMZ_OCR_URL");
  const oldToken = Deno.env.get("AMZ_OCR_TOKEN");
  Deno.env.set("AMZ_OCR_URL", OCR_URL);
  Deno.env.set("AMZ_OCR_TOKEN", "token-sintetico");
  try {
    await fn();
  } finally {
    if (oldUrl == null) Deno.env.delete("AMZ_OCR_URL");
    else Deno.env.set("AMZ_OCR_URL", oldUrl);
    if (oldToken == null) Deno.env.delete("AMZ_OCR_TOKEN");
    else Deno.env.set("AMZ_OCR_TOKEN", oldToken);
  }
}

function localOcrFetch(text: string): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url !== OCR_URL) {
      throw new Error(`chamada externa proibida no teste: ${url}`);
    }
    assertEquals(init?.method, "POST");
    assertEquals(
      new Headers(init?.headers).get("X-OCR-Token"),
      "token-sintetico",
    );
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

function fakeCotacaoSupabase() {
  const sessionWrites: Record<string, unknown>[] = [];
  const documentWrites: Record<string, unknown>[] = [];
  const rows: Record<string, unknown> = {
    whatsapp_cloud_agent_config: null,
    empresa_config: null,
    gestao_os_cotacao_wa_sessao: null,
    gestao_os: { numero: 42, veiculo_id: "veiculo-1" },
    veiculos_estoque: { marca: "Toyota", modelo: "Corolla" },
  };
  const lists: Record<string, unknown[]> = {
    gestao_parceiro: [{
      id: "parceiro-1",
      user_id: "loja-1",
      nome: "Funilaria",
      whatsapp_e164: "5511999990000",
      ativo: true,
    }],
    gestao_os_cotacao: [{
      id: "cotacao-1",
      os_id: "os-1",
      status: "solicitada",
      valor: null,
      prazo_dias: null,
      envio_whatsapp_status: "enviado",
    }],
  };

  const from = (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      order: async () => ({ data: lists[table] ?? [] }),
      maybeSingle: async () => ({ data: rows[table] ?? null }),
      upsert: async (value: Record<string, unknown>) => {
        if (table === "gestao_os_cotacao_wa_sessao") {
          sessionWrites.push(value);
        }
        return { error: null };
      },
      insert: async (value: Record<string, unknown>) => {
        if (table === "gestao_os_documento") documentWrites.push(value);
        return { error: null };
      },
      then: (
        resolve: (value: { data: unknown[] }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: lists[table] ?? [] }).then(resolve, reject),
    };
    return query;
  };

  return {
    sb: {
      from,
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          remove: async () => ({ error: null }),
        }),
      },
    },
    sessionWrites,
    documentWrites,
  };
}

Deno.test({
  name:
    "PRIV-1.1 — foto de orçamento possível usa OCR local e extrai total/prazo",
  permissions: { env: true },
  fn: () =>
    withOcrEnv(async () => {
      const quote = [
        "ORCAMENTO FUNILARIA DO ZE",
        "CNPJ 04.252.011/0001-10",
        "SERVICOS DE FUNILARIA E PINTURA DA PORTA DIANTEIRA",
        "TOTAL R$ 3.800,00",
        "PRAZO 7 DIAS",
      ].join("\n");
      const result = await textoDeOrcamentoParceiroMedia(
        media("image", "image/jpeg", "orcamento.jpg"),
        localOcrFetch(quote),
      );
      assertEquals(result.documentoProtegido, false);
      assertEquals(result.ocrFalhou, false);
      const parsed = parseOrcamentoFromExtractedText(result.texto);
      assertEquals(parsed.valor, 3800);
      assertEquals(parsed.prazoDias, 7);
    }),
});

Deno.test({
  name:
    "PRIV-1.1 — foto com cotação ativa entra no fluxo com valor e prazo do OCR",
  permissions: { env: true },
  fn: () =>
    withOcrEnv(async () => {
      const fake = fakeCotacaoSupabase();
      const result = await tryProcessOsParceiroCotacaoWhatsAppInbound({
        sb: fake.sb as never,
        supabaseUrl: "http://supabase.local",
        serviceKey: "service-key",
        userId: "loja-1",
        fromNumber: "5511999990000",
        userText: "",
        fromIsOwner: false,
        media: [media("image", "image/jpeg", "orcamento.jpg")],
        isProtectedDocument: async () => false,
        fetchImpl: localOcrFetch(
          "ORCAMENTO COMPLETO COM MUITOS ITENS CNPJ 04.252.011/0001-10 TOTAL R$ 3.800,00 PRAZO 7 DIAS",
        ),
      });
      assertEquals(result.handled, true);
      assertStringIncludes(result.reply ?? "", "OS #42");
      const saved = fake.sessionWrites.at(-1);
      assertEquals(saved?.fase, "confirmar_midia");
      assertEquals(
        (saved?.draft_json as Record<string, unknown>)?.valor,
        3800,
      );
      assertEquals(
        (saved?.draft_json as Record<string, unknown>)?.prazo_dias,
        7,
      );
    }),
});

Deno.test({
  name: "PRIV-1.1 — PDF escaneado também usa somente o OCR local",
  permissions: { env: true },
  fn: () =>
    withOcrEnv(async () => {
      const result = await textoDeOrcamentoParceiroMedia(
        media("document", "application/pdf", "orcamento.pdf"),
        localOcrFetch("ORCAMENTO TOTAL R$ 1.950,00 PRAZO 5 DIAS"),
      );
      const parsed = parseOrcamentoFromExtractedText(result.texto);
      assertEquals(parsed.valor, 1950);
      assertEquals(parsed.prazoDias, 5);
    }),
});

Deno.test({
  name:
    "PRIV-1.1 — OCR fora do ar mantém a cotação e pede valor/prazo por texto",
  permissions: { env: true },
  fn: () =>
    withOcrEnv(async () => {
      const fake = fakeCotacaoSupabase();
      const offline = (async (input: string | URL | Request) => {
        const url = String(input);
        if (url !== OCR_URL) {
          throw new Error(`chamada externa proibida no teste: ${url}`);
        }
        return new Response("offline", { status: 503 });
      }) as typeof fetch;
      const result = await tryProcessOsParceiroCotacaoWhatsAppInbound({
        sb: fake.sb as never,
        supabaseUrl: "http://supabase.local",
        serviceKey: "service-key",
        userId: "loja-1",
        fromNumber: "5511999990000",
        userText: "",
        fromIsOwner: false,
        media: [media("image", "image/jpeg", "orcamento.jpg")],
        isProtectedDocument: async () => false,
        fetchImpl: offline,
      });
      assertEquals(result.handled, true);
      assertEquals(result.reply, ORCAMENTO_MEDIA_VALOR_NAO_LIDO);
      assertEquals(fake.sessionWrites.at(-1)?.fase, "valor");
      assertEquals(fake.documentWrites.length, 1);
    }),
});

Deno.test({
  name: "PRIV-1.1 — OCR indisponível pede valor e prazo por texto ou áudio",
  permissions: { env: true },
  fn: () =>
    withOcrEnv(async () => {
      const failLocalOnly = (async (input: string | URL | Request) => {
        const url = String(input);
        if (url !== OCR_URL) {
          throw new Error(`chamada externa proibida no teste: ${url}`);
        }
        return new Response("offline", { status: 503 });
      }) as typeof fetch;
      const result = await textoDeOrcamentoParceiroMedia(
        media("image", "image/jpeg"),
        failLocalOnly,
      );
      assertEquals(result.ocrFalhou, true);
      assertEquals(result.texto, "");
      assertEquals(
        ORCAMENTO_MEDIA_VALOR_NAO_LIDO,
        "Não consegui ler o valor. Pode me mandar o valor total e o prazo por texto ou áudio?",
      );
    }),
});

Deno.test({
  name: "PRIV-1.1 — CNH identificada pelo OCR volta protegida para o cofre",
  permissions: { env: true, read: true },
  fn: () =>
    withOcrEnv(async () => {
      const documentPhoto = media("image", "image/jpeg", "foto.jpg");
      const result = await textoDeOrcamentoParceiroMedia(
        documentPhoto,
        localOcrFetch(
          "CARTEIRA NACIONAL DE HABILITACAO CNH 01234567890",
        ),
      );
      assertEquals(result.documentoProtegido, true);
      assertEquals(result.texto, "");
      assertEquals(documentPhoto.protected_document, true);

      const fake = fakeCotacaoSupabase();
      const inbound = await tryProcessOsParceiroCotacaoWhatsAppInbound({
        sb: fake.sb as never,
        supabaseUrl: "http://supabase.local",
        serviceKey: "service-key",
        userId: "loja-1",
        fromNumber: "5511999990000",
        userText: "",
        fromIsOwner: false,
        media: [media("image", "image/jpeg", "cnh.jpg")],
        isProtectedDocument: async () => false,
        fetchImpl: localOcrFetch("CNH 01234567890"),
      });
      assertEquals(inbound.handled, false);
      assertEquals(inbound.protectedDocument, true);
      const processor = await Deno.readTextFile(
        new URL(
          "../whatsapp-cloud-inbound-processor/index.ts",
          import.meta.url,
        ),
      );
      assertStringIncludes(
        processor,
        "partnerOcrProtected = osParceiroMedia.protectedDocument === true",
      );
      assertStringIncludes(
        processor,
        "partnerChecked?.documento || partnerOcrProtected",
      );
    }),
});

Deno.test("PRIV-1.1 — fluxo de mídia não contém gateway externo", async () => {
  const mediaSource = await Deno.readTextFile(
    new URL("./os-parceiro-orcamento-media.ts", import.meta.url),
  );
  const inboundSource = await Deno.readTextFile(
    new URL("./os-parceiro-inbound.ts", import.meta.url),
  );
  assertEquals(mediaSource.includes("ai.gateway.lovable.dev"), false);
  assertEquals(mediaSource.includes("generativelanguage.googleapis.com"), false);
  assertEquals(mediaSource.includes("api.openai.com"), false);
  assertStringIncludes(inboundSource, "ORCAMENTO_MEDIA_VALOR_NAO_LIDO");
  assertStringIncludes(inboundSource, "leitura.documentoProtegido");
});
