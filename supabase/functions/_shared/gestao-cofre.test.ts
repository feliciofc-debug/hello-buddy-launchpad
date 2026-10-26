import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  cifrarCofreBytes,
  decifrarCofreBytes,
  sha256Hex,
} from "./gestao-cofre-crypto.ts";
import { ML_PUBLIC_VEHICLE_SELECT } from "./ml-vehicle-types.ts";
import { OLX_PUBLIC_VEHICLE_SELECT } from "./olx-vehicle-types.ts";
import { WEBMOTORS_PUBLIC_VEHICLE_SELECT } from "./webmotors-vehicle-types.ts";

function key(fill: number): string {
  return btoa(String.fromCharCode(...new Uint8Array(32).fill(fill)));
}

Deno.test("SEG-DOC — AES-256-GCM cifra e decifra sem expor plaintext", async () => {
  const plain = new TextEncoder().encode("DOCUMENTO SINTÉTICO SEM DADOS REAIS");
  const encrypted = await cifrarCofreBytes(plain, key(7));
  assertEquals(new TextDecoder().decode(encrypted).startsWith("k1."), true);
  assertEquals(
    new TextDecoder().decode(encrypted).includes("DOCUMENTO"),
    false,
  );
  assertEquals(await decifrarCofreBytes(encrypted, key(7)), plain);
});

Deno.test("SEG-DOC — chave errada não decifra", async () => {
  const encrypted = await cifrarCofreBytes(
    new TextEncoder().encode("CRLV SINTÉTICO"),
    key(1),
  );
  await assertRejects(
    () => decifrarCofreBytes(encrypted, key(2)),
    Error,
    "Não foi possível decifrar",
  );
});

Deno.test("SEG-DOC — sem chave recusa antes de gravar aberto", async () => {
  await assertRejects(
    () => cifrarCofreBytes(new Uint8Array([1, 2, 3]), ""),
    Error,
    "DOC_COFRE_KEY não configurada",
  );
});

Deno.test("SEG-DOC — SHA-256 é estável para detectar duplicado", async () => {
  const bytes = new TextEncoder().encode("ARQUIVO SINTÉTICO");
  const a = await sha256Hex(bytes);
  const b = await sha256Hex(bytes);
  assertEquals(a, b);
  assertEquals(a.length, 64);
});

Deno.test("SEG-DOC — migração garante duplicado, RLS e auditoria append-only", async () => {
  const sql = await Deno.readTextFile(
    new URL(
      "../../migrations/20261032270000_seg_doc_cofre.sql",
      import.meta.url,
    ),
  );
  assertStringIncludes(sql, "gestao_documento_user_sha_ativo_uidx");
  assertStringIncludes(sql, "WHERE deleted_at IS NULL");
  assertStringIncludes(sql, "REVOKE ALL ON public.gestao_documento_acesso");
  assertStringIncludes(
    sql,
    "GRANT SELECT ON public.gestao_documento TO authenticated",
  );
  assertStringIncludes(
    sql,
    "GRANT SELECT ON public.gestao_documento_acesso TO authenticated",
  );
  assertEquals(
    /CREATE POLICY gestao_documento_(?:acesso_)?owner_insert/i.test(sql),
    false,
  );
  assertEquals(
    /CREATE POLICY gestao_cofre_(?:insert|select|delete)_owner/i.test(sql),
    false,
  );
  assertEquals(
    /GRANT[^;]*\bINSERT\b[^;]*ON public\.gestao_documento\s/i.test(sql),
    false,
  );
  assertEquals(
    /GRANT[^;]*\b(UPDATE|DELETE)\b[^;]*ON public\.gestao_documento_acesso\s/i
      .test(sql),
    false,
  );
  assertStringIncludes(sql, "column_name = 'public'");
  assertStringIncludes(sql, "'gestao-cofre'");
});

Deno.test("SEG-DOC — logs e auditoria não recebem dados pessoais", async () => {
  const source = await Deno.readTextFile(
    new URL("../gestao-cofre/index.ts", import.meta.url),
  );
  assertStringIncludes(source, "PII_KEYS");
  assertStringIncludes(
    source,
    "Dados pessoais devem ser enviados no campo protegido",
  );
  assertEquals(
    /console\.(log|warn|error)\([^)]*(cpf|cnpj|proprietario|body)/i.test(
      source,
    ),
    false,
  );
});

Deno.test("SEG-DOC — saídas públicas não selecionam renavam ou chassi", async () => {
  for (
    const select of [
      ML_PUBLIC_VEHICLE_SELECT,
      OLX_PUBLIC_VEHICLE_SELECT,
      WEBMOTORS_PUBLIC_VEHICLE_SELECT,
    ]
  ) {
    assertEquals(select.includes("renavam"), false);
    assertEquals(select.includes("chassi"), false);
  }
  const files = [
    "./ml-vehicle-publish-run.ts",
    "./ml-vehicle-sync-run.ts",
    "./olx-vehicle-publish-run.ts",
    "./webmotors-vehicle-publish-run.ts",
    "./webmotors-vehicle-sync-run.ts",
    "./vehicle-stock-showcase-turn.ts",
  ];
  for (const file of files) {
    const source = await Deno.readTextFile(new URL(file, import.meta.url));
    assert(
      !source.includes('.from("veiculos_estoque")\n    .select("*")'),
      `${file} usa select público amplo`,
    );
  }
});
