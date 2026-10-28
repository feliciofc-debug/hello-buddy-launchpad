import {
  assertEquals,
  assertGreater,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Contrato copiado de 20261032320000_gestao_documento_acesso_novas_acoes.sql.
// A migração e esta lista devem ser alteradas juntas.
const ALLOWED_ACTIONS = new Set([
  "upload",
  "ver",
  "abrir",
  "baixar",
  "ler",
  "confirmar",
  "excluir",
  "ler_falha",
  "vincular_automatico",
  "desvincular",
]);

async function productionTypeScriptFiles(directory: URL): Promise<URL[]> {
  const files: URL[] = [];
  for await (const entry of Deno.readDir(directory)) {
    const child = new URL(entry.name, directory);
    if (entry.isDirectory) {
      child.pathname += "/";
      files.push(...await productionTypeScriptFiles(child));
    } else if (entry.isFile && entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts")) {
      files.push(child);
    }
  }
  return files;
}

function collectMatches(
  source: string,
  pattern: RegExp,
  output: Set<string>,
): void {
  for (const match of source.matchAll(pattern)) {
    if (match[1]) output.add(match[1]);
  }
}

Deno.test("COFRE-AUD — ações do código respeitam a constraint do banco", async () => {
  const migration = await Deno.readTextFile(
    new URL(
      "../../migrations/20261032320000_gestao_documento_acesso_novas_acoes.sql",
      import.meta.url,
    ),
  );
  const constraint = migration.match(/acao\s+IN\s*\(([\s\S]*?)\)/i)?.[1] ?? "";
  const migrationActions = new Set(
    [...constraint.matchAll(/'([^']+)'/g)].map((match) => match[1]),
  );
  assertEquals(
    [...migrationActions].sort(),
    [...ALLOWED_ACTIONS].sort(),
    "A lista do teste e a constraint da migração devem mudar juntas",
  );

  const used = new Set<string>();
  const files = await productionTypeScriptFiles(
    new URL("../", import.meta.url),
  );
  for (const file of files) {
    const source = await Deno.readTextFile(file);
    collectMatches(
      source,
      /auditGestaoDocumento\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*["']([^"']+)["']/gs,
      used,
    );
    if (file.pathname.endsWith("/gestao-cofre/index.ts")) {
      collectMatches(
        source,
        /\baudit\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*["']([^"']+)["']/gs,
        used,
      );
    }
    if (source.includes('from("gestao_documento_acesso")')) {
      collectMatches(source, /\bacao\s*:\s*["']([^"']+)["']/g, used);
    }
  }

  assertGreater(used.size, 0);
  assertEquals(
    [...used].filter((action) => !ALLOWED_ACTIONS.has(action)).sort(),
    [],
    "Ação de auditoria sem suporte na constraint do banco",
  );
});
