import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  botoesLegendaParaLogo,
  detectarEscolhaLogo,
  metadataEscolhaLogo,
  VIDEO_LEGENDA_LOGO_BUTTONS,
} from "./video-legenda-logo.ts";

Deno.test("botões de logo cabem no limite do WhatsApp", () => {
  assertEquals(VIDEO_LEGENDA_LOGO_BUTTONS.map((button) => button.title), [
    "Gerar com logo",
    "Gerar sem logo",
  ]);
  assertEquals(
    VIDEO_LEGENDA_LOGO_BUTTONS.every((button) => button.title.length <= 20),
    true,
  );
});

Deno.test("conta com logo recebe botões e conta sem logo mantém confirmação atual", () => {
  assertEquals(
    botoesLegendaParaLogo({ bucket: "tenant-logos", path: "tenant/logo.png" }),
    [
      { id: "video_legenda_com_logo", title: "Gerar com logo" },
      { id: "video_legenda_sem_logo", title: "Gerar sem logo" },
    ],
  );
  assertEquals(botoesLegendaParaLogo(null), null);
});

Deno.test("confirmação com logo persiste a escolha no metadata do job", () => {
  const metadata = metadataEscolhaLogo(
    { logo_bucket: "tenant-logos", logo_path: "tenant/logo.png" },
    "Gerar com logo\n<<INTERACTIVE_ID:video_legenda_com_logo>>",
    { bucket: "tenant-logos", path: "tenant/video.png" },
  );
  assertEquals(metadata.com_logo, true);
  assertEquals(metadata.logo_bucket, "tenant-logos");
  assertEquals(detectarEscolhaLogo("com logo"), true);
});

Deno.test("confirmação comum aplica automaticamente a variante de vídeo", () => {
  assertEquals(
    metadataEscolhaLogo({}, "sim", {
      bucket: "tenant-logos",
      path: "tenant/video.png",
    }).com_logo,
    true,
  );
  assertEquals(metadataEscolhaLogo({}, "sim", null).com_logo, false);
  assertEquals(detectarEscolhaLogo("Gerar sem logo"), false);
});
