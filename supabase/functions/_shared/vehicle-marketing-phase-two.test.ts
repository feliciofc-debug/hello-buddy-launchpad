import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("migration fase 2 é idempotente e não usa storage", async () => {
  const migration = await Deno.readTextFile(
    "supabase/migrations/20261014210000_vehicle_marketing_phase_two.sql",
  );
  assertStringIncludes(migration, "BEGIN;");
  assertStringIncludes(migration, "COMMIT;");
  assertStringIncludes(migration, "ADD COLUMN IF NOT EXISTS modo_postagem_fb");
  assertStringIncludes(migration, "ALTER COLUMN produto_id DROP NOT NULL");
  assertStringIncludes(migration, "NOT VALID");
  assertStringIncludes(migration, "VALIDATE CONSTRAINT");
  assertStringIncludes(migration, "story_imagem");
  assertEquals(migration.includes("storage.buckets"), false);
  assertEquals(migration.includes("storage.objects"), false);
});

Deno.test("vehicle-inventory expõe ferramentas da fase 2 sem ler produtos", async () => {
  const source = await Deno.readTextFile("src/pages/vehicle-inventory.tsx");
  for (
    const modal of [
      "AgendarStoryFotoModal",
      "EngagementModeSelector",
      "PostarLinkedInModal",
      "TextosPersonalizadosProdutoModal",
    ]
  ) {
    assertStringIncludes(source, modal);
  }
  assertEquals(/supabase\s*\.from\(\s*["']produtos["']\s*\)/.test(source), false);
});

Deno.test("modais da fase 2 desviam produtos no ramo veículo", async () => {
  for (
    const path of [
      "src/components/PostarLinkedInModal.tsx",
      "src/components/produtos/EngagementModeSelector.tsx",
      "src/components/produtos/TextosPersonalizadosProdutoModal.tsx",
      "src/components/AgendarStoryFotoModal.tsx",
    ]
  ) {
    const source = await Deno.readTextFile(path);
    assert(
      source.includes('item_tipo === "veiculo"')
        || source.includes("item_tipo === 'veiculo'")
        || source.includes("isVehiclePublishableItem")
        || source.includes("isVehicle"),
      `${path}: ramo veículo ausente`,
    );
    const productRead = Math.max(
      source.indexOf('.from("produtos")'),
      source.indexOf(".from('produtos')"),
    );
    const vehicleGuard = Math.max(
      source.indexOf('item_tipo === "veiculo"'),
      source.indexOf("item_tipo === 'veiculo'"),
      source.indexOf("isVehicle"),
    );
    assert(vehicleGuard >= 0, `${path}: guard veículo ausente`);
    if (productRead >= 0) {
      assert(
        vehicleGuard < productRead || source.includes("isVehicle ?"),
        `${path}: leitura de produtos sem branch veículo`,
      );
    }
  }
});

Deno.test("LinkedIn de veículo usa publishableQueueLink", async () => {
  const source = await Deno.readTextFile("src/components/PostarLinkedInModal.tsx");
  assertStringIncludes(source, "publishableQueueLink(produto)");
  assertStringIncludes(source, 'from("veiculos_estoque")');
});

Deno.test("story de veículo grava metadata com veiculo_id e produto_id null", async () => {
  const source = await Deno.readTextFile("src/components/AgendarStoryFotoModal.tsx");
  assertStringIncludes(source, "produto_id: isVehicle ? null : produto.id");
  assertStringIncludes(source, "veiculo_id: produto.id");
  assertStringIncludes(source, "vehiclePhotos.length > 1");
});

Deno.test("log de engajamento não grava id de veículo em produto_id", async () => {
  const source = await Deno.readTextFile(
    "supabase/functions/generate-social-post-engagement/index.ts",
  );
  const inserts = source.match(/engagement_post_logs'\)\.insert\(\{[\s\S]*?\}\)/g) || [];
  assert(inserts.length >= 2, "esperados dois inserts em engagement_post_logs");
  for (const block of inserts) {
    assertStringIncludes(block, "produto_id: isVehicleRequest ? null : produto.id");
  }
});

Deno.test("AutopilotConfig conta só textos personalizados de produto", async () => {
  const source = await Deno.readTextFile("src/components/AutopilotConfig.tsx");
  assertStringIncludes(source, '.not("produto_id", "is", null)');
});

Deno.test("edges validam veículo pelo dono autenticado", async () => {
  const linkedin = await Deno.readTextFile(
    "supabase/functions/gerar-post-linkedin/index.ts",
  );
  const engagement = await Deno.readTextFile(
    "supabase/functions/generate-social-post-engagement/index.ts",
  );
  assertStringIncludes(linkedin, ".eq('user_id', userId)");
  assertStringIncludes(linkedin, "veiculos_estoque");
  assertStringIncludes(engagement, "userIdDoRequest(req)");
  assertStringIncludes(engagement, "fetchOwnedVehicleRow");
  assertStringIncludes(engagement, "itemTipoBody === 'veiculo'");
});
