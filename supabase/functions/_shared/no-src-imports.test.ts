import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("supabase/functions não importa src/", async () => {
  const cmd = new Deno.Command("rg", {
    args: [
      "-l",
      "from ['\\\"].*(\\.\\./){2}src/|from ['\\\"]src/",
      "supabase/functions",
      "-g",
      "*.ts",
      "-g",
      "!**/*.test.ts",
    ],
    cwd: Deno.cwd(),
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout } = await cmd.output();
  const out = new TextDecoder().decode(stdout).trim();
  if (code === 1 && !out) {
    assertEquals(out, "");
    return;
  }
  if (code === 0 && out) {
    throw new Error(`imports proibidos de src/:\n${out}`);
  }
  assertEquals(code, 1);
});
