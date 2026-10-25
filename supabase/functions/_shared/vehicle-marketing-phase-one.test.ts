import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  publishableCampaignReference,
  publishableImageUrls,
  publishableInstagramReference,
  publishableQueueLink,
} from "../../../src/lib/publishable-item.ts";
import { assertVehicleCanPublish } from "./vehicle-publish-guard.ts";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const VEHICLE_ID = "22222222-2222-4222-8222-222222222222";

Deno.test("produto preserva exatamente os vínculos legados de fila, campanha e Meta", () => {
  const product = { id: PRODUCT_ID, item_tipo: "produto" as const };

  assertEquals(publishableQueueLink(product), {
    produto_id: PRODUCT_ID,
    produto_source: "produtos",
  });
  assertEquals(publishableCampaignReference(product), {
    produto_id: PRODUCT_ID,
  });
  assertEquals(publishableInstagramReference(product), {
    produto_id: PRODUCT_ID,
  });
});

Deno.test("veículo usa somente vínculos próprios e nunca recebe produto_id", () => {
  const vehicle = { id: VEHICLE_ID, item_tipo: "veiculo" as const };

  assertEquals(publishableQueueLink(vehicle), {
    item_tipo: "veiculo",
    veiculo_id: VEHICLE_ID,
    produto_id: null,
    produto_source: "veiculos_estoque",
  });
  assertEquals(publishableCampaignReference(vehicle), {
    item_tipo: "veiculo",
    veiculo_id: VEHICLE_ID,
  });
  assertEquals("produto_id" in publishableCampaignReference(vehicle), false);
});

Deno.test("guarda de publicação aceita disponível e bloqueia vendido, removido e outro tenant", async () => {
  const calls: string[] = [];
  const clientFor = (
    data: { id: string; user_id: string; status: string } | null,
  ) => ({
    from: (table: string) => {
      calls.push(table);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data, error: null }),
          }),
        }),
      };
    },
  });
  const reference = {
    item_tipo: "veiculo",
    veiculo_id: VEHICLE_ID,
    user_id: "tenant-a",
  };

  await assertVehicleCanPublish(
    clientFor({ id: VEHICLE_ID, user_id: "tenant-a", status: "disponivel" }),
    reference,
  );
  await assertRejects(
    () =>
      assertVehicleCanPublish(
        clientFor({ id: VEHICLE_ID, user_id: "tenant-a", status: "vendido" }),
        reference,
      ),
    Error,
    "Veículo vendido",
  );
  await assertRejects(
    () =>
      assertVehicleCanPublish(
        clientFor({ id: VEHICLE_ID, user_id: "tenant-a", status: "em_preparacao" }),
        reference,
      ),
    Error,
    "Veículo em preparação",
  );
  await assertRejects(
    () => assertVehicleCanPublish(clientFor(null), reference),
    Error,
    "Veículo removido",
  );
  await assertRejects(
    () =>
      assertVehicleCanPublish(
        clientFor({ id: VEHICLE_ID, user_id: "tenant-b", status: "disponivel" }),
        reference,
      ),
    Error,
    "outro tenant",
  );
  assertEquals(new Set(calls), new Set(["veiculos_estoque"]));
});

Deno.test("payload legado de produto não faz consulta adicional no guard", async () => {
  let queried = false;
  await assertVehicleCanPublish(
    {
      from: () => {
        queried = true;
        throw new Error("produto não deveria consultar o guard de veículo");
      },
    },
    { user_id: "tenant-a" },
  );
  assertEquals(queried, false);
});

Deno.test("carrossel de veículo preserva todas as fotos e remove duplicadas", () => {
  const fotos = Array.from(
    { length: 12 },
    (_, index) => `https://cdn.example.com/vehicle-${index + 1}.jpg`,
  );
  assertEquals(
    publishableImageUrls({
      imagem_url: fotos[0],
      imagens: [...fotos, fotos[0]],
    }),
    fotos,
  );
});

Deno.test("migration da fase um é aditiva e mantém produto como default", async () => {
  const migration = await Deno.readTextFile(
    "supabase/migrations/20261014190000_vehicle_marketing_phase_one.sql",
  );

  assertEquals(/\bDROP\b/i.test(migration), false);
  assertEquals(/\bRENAME\b/i.test(migration), false);
  assertEquals(/ALTER\s+COLUMN/i.test(migration), false);
  assertStringIncludes(migration, "ADD COLUMN IF NOT EXISTS item_tipo TEXT DEFAULT 'produto'");
  assertStringIncludes(migration, "ADD COLUMN IF NOT EXISTS veiculo_id UUID");
  assertStringIncludes(migration, "item_tipo = 'veiculo'");
  assertStringIncludes(migration, "produto_id IS NULL");
  assertStringIncludes(migration, "CREATE TABLE IF NOT EXISTS public.veiculos_campanhas_recorrentes");
  assertStringIncludes(migration, "ADD COLUMN IF NOT EXISTS incluir_cta_whatsapp");
  assertStringIncludes(migration, "validate_vehicle_social_queue_owner");
  assertStringIncludes(migration, "cancel_vehicle_marketing_on_unavailable");
});

Deno.test("migrations de veículos não dependem das tabelas do Supabase Storage", async () => {
  for (
    const path of [
      "supabase/migrations/20261014190000_vehicle_marketing_phase_one.sql",
      "supabase/migrations/20261014200000_vehicle_marketing_phase_one_idempotent.sql",
    ]
  ) {
    const migration = await Deno.readTextFile(path);
    assertEquals(migration.includes("storage.buckets"), false, path);
    assertEquals(migration.includes("storage.objects"), false, path);
  }

  const correction = await Deno.readTextFile(
    "supabase/migrations/20261014200000_vehicle_marketing_phase_one_idempotent.sql",
  );
  assertStringIncludes(correction, "BEGIN;");
  assertStringIncludes(correction, "COMMIT;");
  assertStringIncludes(correction, "DROP TRIGGER IF EXISTS");
  assertStringIncludes(correction, "DROP POLICY IF EXISTS");
  assertStringIncludes(correction, "CREATE TABLE IF NOT EXISTS");
});

Deno.test("modais Meta de veículo gravam ig-adjusted no bucket produtos", async () => {
  for (
    const path of [
      "src/components/PublicarSimultaneoModal.tsx",
      "src/components/PostarInstagramModal.tsx",
    ]
  ) {
    const source = await Deno.readTextFile(path);
    assertEquals(source.includes('.from("veiculos")'), false, path);
    assertEquals(source.includes(".from('veiculos')"), false, path);
    assertStringIncludes(source, '.from("produtos")', path);
    assertStringIncludes(source, "/ig-adjusted/", path);
  }
});

Deno.test("upload de veículo usa o bucket produtos em subpasta isolada", async () => {
  const vehiclePage = await Deno.readTextFile("src/pages/vehicle-inventory.tsx");
  assertStringIncludes(vehiclePage, '.from("produtos")');
  assertStringIncludes(
    vehiclePage,
    "`${user.id}/veiculos/${vehicleId}/${fileName}`",
  );
  assertEquals(vehiclePage.includes('.from("veiculos")'), false);
});

Deno.test("modais de veículo desviam antes de qualquer leitura de produtos", async () => {
  for (
    const path of [
      "src/components/PostarFacebookModal.tsx",
      "src/components/PostarInstagramModal.tsx",
      "src/components/PublicarSimultaneoModal.tsx",
    ]
  ) {
    const source = await Deno.readTextFile(path);
    const vehicleGuard = source.indexOf("if (isVehicle)");
    const productRead = Math.max(
      source.indexOf('.from("produtos")'),
      source.indexOf(".from('produtos')"),
    );
    assert(vehicleGuard >= 0, `${path}: guard de veículo ausente`);
    assert(productRead > vehicleGuard, `${path}: produtos lido antes do guard`);
    assertStringIncludes(
      source.slice(vehicleGuard, productRead),
      "return",
      `${path}: fluxo de veículo não encerra antes da leitura de produtos`,
    );
  }
});

Deno.test("gerador genérico recebe veículo no payload sem captions de anúncio", async () => {
  for (
    const path of [
      "src/components/PostarFacebookModal.tsx",
      "src/components/PostarInstagramModal.tsx",
      "src/components/PublicarSimultaneoModal.tsx",
    ]
  ) {
    const source = await Deno.readTextFile(path);
    assertStringIncludes(source, 'functions.invoke("gerar-posts"');
    assertEquals(source.includes("anuncio-veiculo-captions"), false);
  }
});

Deno.test("executor social cancela veículo vendido ou removido sem alterar ramo de produto", async () => {
  const source = await Deno.readTextFile(
    "supabase/functions/executar-social-programado/index.ts",
  );

  assertStringIncludes(
    source,
    "post.produto_id && post.produto_source === 'produtos'",
  );
  assertStringIncludes(source, "post.item_tipo === 'veiculo' && post.veiculo_id");
  assertStringIncludes(source, "vehicle.status === 'vendido'");
  assertStringIncludes(source, "'veiculo_vendido'");
  assertStringIncludes(source, "'veiculo_removido'");
});

Deno.test("campanha de veículo usa tabela própria e mantém consulta legada de produto", async () => {
  const modal = await Deno.readTextFile(
    "src/components/CriarCampanhaWhatsAppModal.tsx",
  );
  const executor = await Deno.readTextFile(
    "supabase/functions/executar-campanhas-agendadas/index.ts",
  );

  assertStringIncludes(modal, "? 'veiculos_campanhas_recorrentes'");
  assertStringIncludes(modal, ": 'campanhas_recorrentes'");
  assertStringIncludes(executor, '.from("campanhas_recorrentes")');
  assertStringIncludes(executor, '.from("veiculos_campanhas_recorrentes")');
  assertStringIncludes(executor, "vehicle.status === \"vendido\"");
  assertStringIncludes(executor, "vehicleToCampaignItem");
});

Deno.test("fase um não conecta veículos a tabelas de produto", async () => {
  const vehiclePage = await Deno.readTextFile("src/pages/vehicle-inventory.tsx");
  const migration = await Deno.readTextFile(
    "supabase/migrations/20261014190000_vehicle_marketing_phase_one.sql",
  );

  assertEquals(
    /supabase\s*\.from\(\s*["']produtos["']\s*\)/.test(vehiclePage),
    false,
  );
  assertEquals(
    /veiculo_id\s+UUID\s+REFERENCES\s+public\.produtos/i.test(migration),
    false,
  );
});
