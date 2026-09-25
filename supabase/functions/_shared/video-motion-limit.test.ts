import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  COTA_DIARIA_MOTION_PADRAO,
  cotaDiariaMotionDoTenant,
} from "./video-motion-enfileirar.ts";

function fakeConfig(data: Record<string, unknown> | null, error: { message: string } | null = null) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data, error }),
  };
  return { from: () => query };
}

Deno.test("usa a cota diária configurada no tenant", async () => {
  assertEquals(
    await cotaDiariaMotionDoTenant(fakeConfig({ motion_video_daily_limit: 50 }), "tenant-1"),
    50,
  );
});

Deno.test("NULL desativa somente a cota diária", async () => {
  assertEquals(
    await cotaDiariaMotionDoTenant(fakeConfig({ motion_video_daily_limit: null }), "tenant-owner"),
    null,
  );
});

Deno.test("usa fallback razoável sem configuração válida", async () => {
  assertEquals(
    await cotaDiariaMotionDoTenant(fakeConfig(null), "tenant-sem-config"),
    COTA_DIARIA_MOTION_PADRAO,
  );
  assertEquals(
    await cotaDiariaMotionDoTenant(fakeConfig({ motion_video_daily_limit: -1 }), "tenant-invalido"),
    COTA_DIARIA_MOTION_PADRAO,
  );
});
