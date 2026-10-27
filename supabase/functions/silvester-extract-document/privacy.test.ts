import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractSilvesterConversationText } from "./privacy.ts";

Deno.test("PRIV-1 — Silvester aceita texto, mas payload externo nunca contém mídia", async () => {
  let calls = 0;
  const result = await extractSilvesterConversationText({
    text: "Cliente quer uma carta para comprar um carro.",
    apiKey: "test",
    fetchFn: (async (_url, init) => {
      calls++;
      const payload = String(init?.body || "");
      if (
        /data:[^;,]+;base64,/i.test(payload) ||
        /image_url|file_data|inline_data|"media"\s*:/i.test(payload)
      ) {
        throw new Error("Silvester tentou enviar mídia");
      }
      assertStringIncludes(payload, "Cliente quer uma carta");
      return new Response(
        JSON.stringify({
          choices: [{
            message: { content: '{"interesse_bem":"auto"}' },
          }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch,
  });
  assertEquals(calls, 1);
  assertEquals(result, { interesse_bem: "auto" });
});

Deno.test("PRIV-1 — hook e função Silvester não recuperam nem processam mídia", async () => {
  const processor = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const hook = processor.slice(
    processor.indexOf("// === SILVESTER DOSSIÊ"),
    processor.indexOf("// EBOOK DE PRESENTE"),
  );
  assertStringIncludes(hook, "media: []");
  assertEquals(hook.includes("recentMidias"), false);
  assertEquals(hook.includes("mediaPayload"), false);

  const silvester = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );
  assertEquals(silvester.includes("callVision"), false);
  assertEquals(silvester.includes("fetchAsBase64"), false);
  assertEquals(silvester.includes("image_url"), false);
  assertStringIncludes(silvester, "campo media");
});
