import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildVideoRenderLogoClaim } from "./video-render-logo.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";

Deno.test("claim inclui logo assinada por uma hora quando solicitada", async () => {
  let signed: unknown[] = [];
  const logo = await buildVideoRenderLogoClaim({
    user_id: USER_ID,
    metadata: {
      com_logo: true,
      logo_bucket: "tenant-logos",
      logo_path: `${USER_ID}/logo.png`,
    },
  }, (bucket, path, ttl) => {
    signed = [bucket, path, ttl];
    return Promise.resolve("https://storage.example/logo-signed");
  });

  assertEquals(signed, ["tenant-logos", `${USER_ID}/logo.png`, 3600]);
  assertEquals(logo, {
    download_url: "https://storage.example/logo-signed",
    posicao: "topo",
    largura_ratio: 0.22,
    margem_ratio: 0.04,
  });
});

Deno.test("claim omite logo quando não solicitada", async () => {
  let called = false;
  const logo = await buildVideoRenderLogoClaim({
    user_id: USER_ID,
    metadata: {
      com_logo: false,
      logo_bucket: "tenant-logos",
      logo_path: `${USER_ID}/logo.png`,
    },
  }, () => {
    called = true;
    return Promise.resolve("não deve ser usada");
  });
  assertEquals(logo, null);
  assertEquals(called, false);
});

Deno.test("claim ignora logo fora da pasta do tenant", async () => {
  const logo = await buildVideoRenderLogoClaim({
    user_id: USER_ID,
    metadata: {
      com_logo: true,
      logo_bucket: "tenant-logos",
      logo_path: "outro-tenant/logo.png",
    },
  }, () => Promise.resolve("não deve ser usada"));
  assertEquals(logo, null);
});
