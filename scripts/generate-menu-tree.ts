import { renderJarvisMenuTreeMarkdown } from "../supabase/functions/_shared/jarvis-menu-tree.ts";

const output = new URL("../docs/menu-arvore.md", import.meta.url);

await Deno.writeTextFile(output, renderJarvisMenuTreeMarkdown());
console.log(`Árvore do menu gerada em ${output.pathname}`);
