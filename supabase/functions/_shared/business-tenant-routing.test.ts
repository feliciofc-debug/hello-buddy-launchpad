import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  businessTenantHomePath,
  isBusinessTenantType,
} from "../../../src/lib/business-tenant.ts";

Deno.test("empresa continua entrando pelo dashboard", () => {
  assertEquals(isBusinessTenantType("empresa"), true);
  assertEquals(businessTenantHomePath("empresa"), "/dashboard");
});

Deno.test("revenda entra no mesmo dashboard da empresa", () => {
  assertEquals(isBusinessTenantType("revenda_veiculos"), true);
  assertEquals(businessTenantHomePath("revenda_veiculos"), "/dashboard");
});

Deno.test("login nunca direciona revenda diretamente ao estoque", async () => {
  const loginSource = await Deno.readTextFile("src/pages/Login.tsx");
  const helperSource = await Deno.readTextFile("src/lib/business-tenant.ts");
  assertEquals(loginSource.includes('navigate("/veiculos")'), false);
  assertEquals(helperSource.includes('return "/veiculos"'), false);
});

Deno.test("AMZ Auto pós-login cai no dashboard com menu lateral", async () => {
  const entrarSource = await Deno.readTextFile(
    "src/pages/amz-auto/AmzAutoEntrarPage.tsx",
  );
  const dashSource = await Deno.readTextFile("src/pages/DashboardMetricas.tsx");
  assert(entrarSource.includes("AMZ_AUTO_PLATFORM_HOME_PATH"));
  assertEquals(entrarSource.includes('navigate("/veiculos")'), false);
  assert(dashSource.includes("AMZ_AUTO_PLATFORM_HOME_PATH"));
  const abrirIdx = dashSource.indexOf("Abrir AMZ Auto");
  const adminOpenBlock = dashSource.slice(Math.max(0, abrirIdx - 280), abrirIdx + 80);
  assertEquals(adminOpenBlock.includes("navigate('/veiculos')"), false);
  assert(adminOpenBlock.includes("AMZ_AUTO_PLATFORM_HOME_PATH"));
});

Deno.test("outros tipos não são tenants empresariais", () => {
  assertEquals(isBusinessTenantType("b2b"), false);
  assertEquals(isBusinessTenantType("parceiro"), false);
  assertEquals(isBusinessTenantType(null), false);
});

Deno.test("login libera tenant empresarial antes de consultar assinatura", async () => {
  const source = await Deno.readTextFile("src/pages/Login.tsx");
  const businessGuard = source.indexOf(
    "if (isBusinessTenantType(profile?.tipo))",
  );
  const subscriptionCheck = source.indexOf(
    "supabase.functions.invoke('check-subscription')",
  );
  assert(businessGuard >= 0);
  assert(subscriptionCheck > businessGuard);
  assert(source.includes("navigate(businessTenantHomePath(profile?.tipo))"));
});

Deno.test("dashboard legado usa o helper em regras empresariais", async () => {
  const source = await Deno.readTextFile("src/pages/Dashboard.tsx");
  assertEquals(source.includes("tipo === 'empresa'"), false);
  assertEquals(source.includes("tipo !== 'empresa'"), false);
  assert(source.includes("isBusinessTenantType(userProfile?.tipo)"));
});
