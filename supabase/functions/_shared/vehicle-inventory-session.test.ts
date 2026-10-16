import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SOURCE_PATH = "src/pages/vehicle-inventory.tsx";

Deno.test("estoque consulta a sessão antes da validação complementar", async () => {
  const source = await Deno.readTextFile(SOURCE_PATH);
  const helperStart = source.indexOf("async function getVehicleSessionUser()");
  const sessionCall = source.indexOf("supabase.auth.getSession()", helperStart);
  const userCall = source.indexOf("supabase.auth.getUser()", helperStart);

  assert(helperStart >= 0);
  assert(sessionCall > helperStart);
  assert(userCall > sessionCall);
});

Deno.test("estoque conserva usuário da sessão se getUser falhar", async () => {
  const source = await Deno.readTextFile(SOURCE_PATH);
  assert(source.includes("verifiedData.user ?? sessionUser"));
  assert(source.includes("if (!sessionUser)"));
  assertEquals(
    source.includes("const { data: { user } } = await supabase.auth.getUser()"),
    false,
  );
});

Deno.test("redirecionamentos de estoque registram o motivo", async () => {
  const source = await Deno.readTextFile(SOURCE_PATH);
  const redirect = source.indexOf('navigate("/login")');
  const warning = source.lastIndexOf("console.warn", redirect);
  assert(redirect >= 0);
  assert(warning >= 0);
  assert(warning < redirect);
});
