export type ForbiddenSrcImportHit = {
  line: number;
  text: string;
};

/** Caminhos de módulo que apontam para src/ ou alias @/ (proibidos em Edge Functions). */
export function isForbiddenSrcImportSpecifier(specifier: string): boolean {
  const norm = specifier.trim().replace(/\\/g, "/");
  if (!norm) return false;
  if (norm.startsWith("@/")) return true;
  if (norm.startsWith("src/")) return true;
  if (norm.includes("/src/")) return true;
  return false;
}

function specifiersFromLine(line: string): string[] {
  const specs: string[] = [];
  if (/^\s*(?:import|export)\b/.test(line)) {
    for (const m of line.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      specs.push(m[1]);
    }
    for (const m of line.matchAll(/^\s*import\s+['"]([^'"]+)['"]/g)) {
      specs.push(m[1]);
    }
  }
  for (const m of line.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    specs.push(m[1]);
  }
  return specs;
}

/** Varre o texto de um arquivo .ts e lista imports proibidos de src/ ou @/. */
export function findForbiddenSrcImports(source: string): ForbiddenSrcImportHit[] {
  const hits: ForbiddenSrcImportHit[] = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const spec of specifiersFromLine(line)) {
      if (isForbiddenSrcImportSpecifier(spec)) {
        hits.push({ line: i + 1, text: line });
      }
    }
  }
  return hits;
}

export async function* walkProductionTsFiles(
  rootDir: string,
): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(rootDir)) {
    const path = `${rootDir}/${entry.name}`;
    if (entry.isDirectory) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      yield* walkProductionTsFiles(path);
    } else if (
      entry.isFile &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts")
    ) {
      yield path;
    }
  }
}

export async function scanDirectoryForForbiddenSrcImports(
  rootDir: string,
): Promise<Array<{ file: string; line: number; text: string }>> {
  const violations: Array<{ file: string; line: number; text: string }> = [];
  for await (const file of walkProductionTsFiles(rootDir)) {
    const source = await Deno.readTextFile(file);
    for (const hit of findForbiddenSrcImports(source)) {
      violations.push({ file, line: hit.line, text: hit.text });
    }
  }
  return violations;
}
