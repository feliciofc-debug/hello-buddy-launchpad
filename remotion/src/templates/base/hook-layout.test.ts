import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { balanceTitleLines, computeHookLayout } from "./hook-layout";

const realCase = {
  kicker: "CASA PRÓPRIA SEM JUROS",
  lines: ["Ainda pagando aluguel", "e sonhando com a", "casa própria?"],
  highlight: "PLANEJE SEU FUTURO",
  sub: undefined,
  hasLogo: true,
};

describe("safe hook layout", () => {
  for (const [name, width, height] of [
    ["9:16", 1080, 1920],
    ["1:1", 1080, 1080],
    ["16:9", 1920, 1080],
  ] as const) {
    test(`${name} mantém logo quadrada e texto dentro da área segura`, () => {
      const layout = computeHookLayout({ ...realCase, width, height });
      assert.ok(layout.estimatedHeight <= layout.safeHeight);
      assert.ok(layout.logoHeight >= layout.logoMinHeight);
      assert.ok(layout.titleFontSize >= 24);
    });
  }

  test("equilibra o título sem deixar palavra órfã", () => {
    const lines = balanceTitleLines(
      ["Ainda pagando aluguel e sonhando com a casa própria?"],
      3,
    );
    assert.ok(lines.every((line) => line.trim().split(/\s+/).length > 1));
    const lengths = lines.map((line) => line.length);
    assert.ok(Math.max(...lengths) - Math.min(...lengths) < 12);
  });
});
