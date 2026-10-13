import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mediaThenButtonPayloads } from "./whatsapp-media-buttons.ts";

Deno.test("vídeo com botões gera dois envios e mantém o vídeo primeiro", () => {
  const payloads = mediaThenButtonPayloads({
    to: "+55 (11) 99999-0000",
    message: "🎬 Pronto! Legenda queimada na tela.",
    videoUrl: "https://cdn.example/video-legendado.mp4",
    interactiveButtons: {
      body: "O que você quer fazer agora?",
      buttons: [
        { id: "ready_media:publish:video:12345678", title: "Publicar agora" },
        { id: "ready_media:schedule:video:12345678", title: "Agendar" },
      ],
    },
  });

  assertEquals(payloads?.length, 2);
  assertEquals(payloads?.[0], {
    messaging_product: "whatsapp",
    to: "5511999990000",
    type: "video",
    video: {
      link: "https://cdn.example/video-legendado.mp4",
      caption: "🎬 Pronto! Legenda queimada na tela.",
    },
  });
  assertEquals(payloads?.[1]?.type, "interactive");
});

Deno.test("imagem com botões também envia a imagem antes das ações", () => {
  const payloads = mediaThenButtonPayloads({
    to: "5511999990000",
    message: "Imagem pronta.",
    imageUrl: "https://cdn.example/editada.jpg",
    interactiveButtons: {
      body: "O que você quer fazer agora?",
      buttons: [{ id: "ready_media:publish:foto:12345678", title: "Publicar" }],
    },
  });

  assertEquals(payloads?.map((payload) => payload.type), [
    "image",
    "interactive",
  ]);
});
