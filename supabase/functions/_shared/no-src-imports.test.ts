import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  findForbiddenSrcImports,
  scanDirectoryForForbiddenSrcImports,
} from "./no-src-imports.ts";

const FUNCTIONS_ROOT = new URL("..", import.meta.url).pathname;

Deno.test("findForbiddenSrcImports detecta import de ../../src/", () => {
  const hits = findForbiddenSrcImports(
    `import x from "../../src/lib/a.ts";`,
  );
  assertEquals(hits.length, 1);
  assertEquals(hits[0].line, 1);
});

Deno.test("findForbiddenSrcImports ignora import relativo normal", () => {
  assertEquals(
    findForbiddenSrcImports(`import x from "./vehicle-stock-whatsapp.ts";`).length,
    0,
  );
});

Deno.test("findForbiddenSrcImports detecta @/ e import dinâmico", () => {
  assertEquals(
    findForbiddenSrcImports(`import { z } from "@/components/ui";`).length,
    1,
  );
  assertEquals(
    findForbiddenSrcImports(
      `const m = await import("../foo/src/bar.ts");`,
    ).length,
    1,
  );
});

Deno.test("supabase/functions não importa src/", async () => {
  const violations = await scanDirectoryForForbiddenSrcImports(FUNCTIONS_ROOT);
  if (violations.length > 0) {
    const msg = violations
      .map((v) => `${v.file}:${v.line}: ${v.text.trim()}`)
      .join("\n");
    throw new Error(`imports proibidos de src/ ou @/:\n${msg}`);
  }
  assertEquals(violations.length, 0);
});
