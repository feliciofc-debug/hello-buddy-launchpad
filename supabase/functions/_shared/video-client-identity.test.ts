import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canRunClientLogoRegistrationShortcut,
  clientLogoUploadFollowUp,
  extractVideoClientName,
  hasUsableVideoTopic,
  isSameVideoBrandName,
  isVideoMotionRequest,
  resolveAutomaticVideoSiteIdentity,
  selectVideoClientLogo,
  shouldStartVideoSetup,
} from "./video-client-identity.ts";

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
