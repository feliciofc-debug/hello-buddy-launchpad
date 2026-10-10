import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  cachedOrTranscribedVideoSegments,
  parseVideoTranscriptionAction,
  transcribeVideoWithFallback,
  videoTranscriptionRecoveryButtons,
} from "./video-transcription-flow.ts";

const MEDIA_ID = "12345678-1234-4123-8123-123456789abc";

function gatewayResponse(content: string): Response {
  return Response.json({
    choices: [{ message: { content } }],
  });
}

Deno.test("transcrição tenta modelo reserva quando a primeira vem vazia", async () => {
  const calls: string[] = [];
  const responses = [
    gatewayResponse('{"segments":[]}'),
    gatewayResponse(
      '{"segments":[{"start":0,"end":2,"text":"Olá, mundo."}]}',
    ),
  ];
  const segments = await transcribeVideoWithFallback({
    endpoint: "https://gateway.test",
    apiKey: "test",
    prompt: "Transcreva",
    videoUrl: "https://cdn.test/video.mp4",
    fetcher: async (_url, init) => {
      calls.push(JSON.parse(String(init?.body)).model);
      return responses.shift()!;
    },
  });

  assertEquals(calls, [
    "google/gemini-3.6-flash",
    "google/gemini-3.1-pro-preview",
  ]);
  assertEquals(segments, [{ start: 0, end: 2, text: "Olá, mundo." }]);
});

Deno.test("duas tentativas vazias mantêm recuperação com dois botões", async () => {
  let calls = 0;
  const segments = await transcribeVideoWithFallback({
    endpoint: "https://gateway.test",
    apiKey: "test",
    prompt: "Transcreva",
    videoUrl: "https://cdn.test/video.mp4",
    fetcher: async () => {
      calls++;
      return gatewayResponse(calls === 1 ? "não é JSON" : '{"segments":[]}');
    },
  });
  const recovery = videoTranscriptionRecoveryButtons(MEDIA_ID);

  assertEquals(segments, []);
  assertEquals(calls, 2);
  assertEquals(
    recovery.buttons.map((button) => button.title),
    ["🔄 Tentar de novo", "✍️ Vou escrever o tema"],
  );
  assertEquals(
    parseVideoTranscriptionAction(
      `<<INTERACTIVE_ID:${recovery.buttons[0].id}>>`,
    ),
    { action: "retry", mediaId: MEDIA_ID },
  );
});

Deno.test("transcrição válida do mesmo vídeo usa cache sem chamar gateway", async () => {
  let gatewayCalls = 0;
  const result = await cachedOrTranscribedVideoSegments({
    rows: [{
      video_path: "originais/video.mp4",
      segmentos: [{ start: 1, end: 3, text: "Trecho em cache" }],
      metadata: { midia_id: MEDIA_ID },
    }],
    videoPath: "outro-caminho.mp4",
    mediaId: MEDIA_ID,
    transcribe: async () => {
      gatewayCalls++;
      return [];
    },
  });

  assertEquals(result.source, "cache");
  assertEquals(result.segments, [{
    start: 1,
    end: 3,
    text: "Trecho em cache",
  }]);
  assertEquals(gatewayCalls, 0);
});
