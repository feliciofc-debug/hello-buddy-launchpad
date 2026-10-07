import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canRunClientLogoRegistrationShortcut,
  classifyCreativeMediaRequest,
  clientLogoUploadFollowUp,
  extractVideoClientName,
  hasUsableVideoTopic,
  isClearlyDifferentFromPendingVideo,
  isSameVideoBrandName,
  isVideoMotionRedoRequest,
  isVideoMotionRequest,
  resolveAutomaticVideoSiteIdentity,
  selectVideoClientLogo,
  shouldStartVideoSetup,
} from "./video-client-identity.ts";

Deno.test("reconhece pedido para refazer vídeo sem tratar como criação nova", () => {
  assertEquals(
    isVideoMotionRedoRequest("Refaz o vídeo com fundo branco"),
    true,
  );
  assertEquals(
    isVideoMotionRedoRequest("Corrige o título do vídeo"),
    true,
  );
  assertEquals(
    isVideoMotionRedoRequest("Troca o cenário desta foto: mesa de café"),
    false,
  );
  assertEquals(
    isVideoMotionRedoRequest(
      "muda o fundo",
      "2026-10-07T13:55:00.000Z",
      Date.parse("2026-10-07T14:00:00.000Z"),
    ),
    true,
  );
  assertEquals(
    isVideoMotionRedoRequest(
      "muda o fundo desta imagem",
      "2026-10-07T13:55:00.000Z",
      Date.parse("2026-10-07T14:00:00.000Z"),
    ),
    false,
  );
  assertEquals(isVideoMotionRedoRequest("Crie um vídeo novo"), false);
});

Deno.test("extrai o cliente em pedidos reais sem confundir duração, assunto ou formato", () => {
  assertEquals(
    extractVideoClientName("cria um vídeo da Ademicon sobre consórcio"),
    "Ademicon",
  );
  assertEquals(
    extractVideoClientName("cria um vídeo de 30 segundos para a AMZ Ofertas"),
    "AMZ Ofertas",
  );
  assertEquals(
    extractVideoClientName(
      "cria um vídeo de 45 segundos sobre consórcio de imóvel da Ademicon, formato vertical...",
    ),
    "Ademicon",
  );
  assertEquals(
    extractVideoClientName("faz um vídeo da AMZ Ofertas"),
    "AMZ Ofertas",
  );
});

Deno.test("marca pedida igual à marca normalizada do tenant usa identidade própria", () => {
  assertEquals(isSameVideoBrandName("AMZ Ofertas", "amz ofertas"), true);
  assertEquals(isSameVideoBrandName("Ademicon", "AMZ Ofertas"), false);
  assertEquals(isSameVideoBrandName(null, "AMZ Ofertas"), false);
});

Deno.test("logo manual do cliente tem prioridade sobre logo encontrada no site", () => {
  assertEquals(
    selectVideoClientLogo({
      manualLogoPath: "tenant/client-brands/manual.png",
      siteLogoPath: "tenant/client-brands/site.png",
    }),
    {
      path: "tenant/client-brands/manual.png",
      source: "whatsapp_manual",
    },
  );
  assertEquals(
    selectVideoClientLogo({
      manualLogoPath: "tenant/client-brands/manual.png",
      siteLogoPath: "tenant/client-brands/site.png",
      withoutLogo: true,
    }),
    { source: "none" },
  );
});

Deno.test("vídeo do cliente usa nome pedido, logo confiável e cores automaticamente", () => {
  assertEquals(
    extractVideoClientName(
      "Faça um vídeo institucional da Ademicon usando https://ademicon.com.br",
    ),
    "Ademicon",
  );
  assertEquals(
    resolveAutomaticVideoSiteIdentity({
      requestedClientName: "Ademicon",
      siteBrandName: "Ademicon Consórcio",
      siteUrl: "https://ademicon.com.br",
      colors: ["#ee3124", "#ffffff", "#ee3124"],
      logoConfidence: "high",
      logoDataUrl: "data:image/png;base64,bG9nbw==",
    }),
    {
      clientName: "Ademicon",
      colors: ["#ee3124", "#ffffff"],
      useSiteLogo: true,
      summary: "Ademicon — logo do site + cores #ee3124 · #ffffff",
    },
  );
});

Deno.test("site sem logo confiável segue somente com cores e nome do site", () => {
  assertEquals(
    resolveAutomaticVideoSiteIdentity({
      siteBrandName: "Marca do Site",
      siteUrl: "https://marca.example",
      colors: ["#123456", "#abcdef"],
      logoConfidence: "none",
      logoDataUrl: null,
    }),
    {
      clientName: "Marca do Site",
      colors: ["#123456", "#abcdef"],
      useSiteLogo: false,
      summary: "Marca do Site — cores #123456 · #abcdef",
    },
  );
});

Deno.test("ícone de confiança média nunca é usado como logo automática", () => {
  const identity = resolveAutomaticVideoSiteIdentity({
    siteBrandName: "Marca do Site",
    siteUrl: "https://marca.example",
    colors: ["#123456"],
    logoConfidence: "medium",
    logoDataUrl: "data:image/png;base64,RkFWSUNPTg==",
  });
  assertEquals(identity.useSiteLogo, false);
});

Deno.test("atalho de cadastro não captura fluxo de vídeo nem respostas interativas", () => {
  assertEquals(
    canRunClientLogoRegistrationShortcut({
      text: "Usar esta logo",
      hasPendingVideoSetup: true,
    }),
    false,
  );
  for (
    const id of [
      "video_site_logo_use",
      "brand_image_logo",
      "social_publish:12345678",
    ]
  ) {
    assertEquals(
      canRunClientLogoRegistrationShortcut({
        text: `Usar esta logo\n<<INTERACTIVE_ID:${id}>>`,
        hasPendingVideoSetup: false,
      }),
      false,
    );
  }
  assertEquals(
    canRunClientLogoRegistrationShortcut({
      text: "Salve essa logo como logo da Ademicon",
      hasPendingVideoSetup: false,
    }),
    true,
  );
  assertEquals(
    canRunClientLogoRegistrationShortcut({
      text: "salva essa logo do cliente Pimenta",
      hasPendingVideoSetup: false,
    }),
    true,
  );
  assertEquals(
    canRunClientLogoRegistrationShortcut({
      text: "essa é a logo da Ademicon",
      hasPendingVideoSetup: false,
    }),
    true,
  );
});

Deno.test("atalho de cadastro não captura roteiro longo que menciona logo", () => {
  const roteiro = `ROTEIRO — VÍDEO ANIMADO COMEXIA
Cena 1 (0–5s): fundo escuro com o texto "Sua importação começa aqui".
Cena 2 (5–10s): mostrar o fluxo da plataforma e destacar agilidade.
Cena 3 (10–15s): entrar com a logo da comexia e encerrar com uma chamada para ação.`;

  assertEquals(
    canRunClientLogoRegistrationShortcut({
      text: roteiro,
      hasPendingVideoSetup: false,
    }),
    false,
  );
  assertEquals(isVideoMotionRequest(roteiro), false);
  assertEquals(shouldStartVideoSetup(roteiro), true);
});

Deno.test("atalho de cadastro ignora pedidos curtos de criação", () => {
  for (
    const text of [
      "Crie um vídeo usando a logo da Comexia",
      "Monte um carrossel com a logo da Comexia",
      "Faça uma imagem com a logo da Comexia",
    ]
  ) {
    assertEquals(
      canRunClientLogoRegistrationShortcut({
        text,
        hasPendingVideoSetup: false,
      }),
      false,
    );
  }
  assertEquals(
    isVideoMotionRequest("Criar um vídeo animado de 45 segundos"),
    true,
  );
  assertEquals(hasUsableVideoTopic("de 45 segundos"), false);
  assertEquals(hasUsableVideoTopic("animado de 45 segundos"), false);
  assertEquals(
    hasUsableVideoTopic("campanha da Comexia com o roteiro enviado"),
    true,
  );
});

Deno.test("roteiro sem contexto de vídeo não abre setup", () => {
  assertEquals(
    shouldStartVideoSetup("cria um roteiro de atendimento"),
    false,
  );
});

Deno.test("publicação de vídeo existente não abre criação de vídeo", () => {
  for (
    const text of [
      "quero postar esse vídeo no instagram",
      "publica o último vídeo",
      "quero agendar o vídeo ID da mídia: A1B2C3D4",
    ]
  ) {
    assertEquals(isVideoMotionRequest(text), false);
    assertEquals(shouldStartVideoSetup(text), false);
  }
  assertEquals(
    shouldStartVideoSetup("cria um vídeo e posta no instagram"),
    true,
  );
});

Deno.test("pedido de vídeo de não-dono continua identificável para orientação", () => {
  assertEquals(isVideoMotionRequest("faz um vídeo pra mim"), true);
});

Deno.test("pedido explícito de arte não é desviado pela palavra vídeo na descrição", () => {
  const pedido =
    "Cria uma arte de anúncio em que aparecem prontos um post, um vídeo e um anúncio";
  assertEquals(classifyCreativeMediaRequest(pedido), "image");
  assertEquals(isVideoMotionRequest(pedido), false);
  assertEquals(shouldStartVideoSetup(pedido), false);
});

Deno.test("pedido realmente ambíguo entre vídeo e imagem é identificado", () => {
  assertEquals(
    classifyCreativeMediaRequest("Quero criar um conteúdo em vídeo ou imagem"),
    "ambiguous",
  );
});

Deno.test("pedido novo de arte interrompe escolha pendente sem parecer trilha", () => {
  assertEquals(
    isClearlyDifferentFromPendingVideo("Cria uma arte para divulgar o produto"),
    true,
  );
  assertEquals(isClearlyDifferentFromPendingVideo("Sem trilha"), false);
});

Deno.test("cadastro de logo sem foto oferece continuação clara", () => {
  assertEquals(
    clientLogoUploadFollowUp("Pimenta", "foto_ausente"),
    "Envie a logo do Pimenta agora em PNG, JPEG ou WEBP. Assim que receber a imagem, vou cadastrá-la automaticamente. Se preferir desistir, responda *cancelar*.",
  );
  assertEquals(
    clientLogoUploadFollowUp("Pimenta", "persistencia_falhou"),
    null,
  );
});
