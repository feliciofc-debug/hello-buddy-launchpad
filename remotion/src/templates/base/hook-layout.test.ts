import { describe, expect, test } from "bun:test";
import { balanceTitleLines, computeHookLayout } from "./hook-layout";

const realCase = {
  kicker: "CASA PRÓPRIA SEM JUROS",
  lines: ["Ainda pagando aluguel", "e sonhando com a", "casa própria?"],
  highlight: "PLANEJE SEU FUTURO",
  sub: undefined,
  hasLogo: true,
};

describe("safe hook layout", () => {
  test.each([
    ["9:16", 1080, 1920],
    ["1:1", 1080, 1080],
    ["16:9", 1920, 1080],
  ])("%s mantém logo quadrada e texto dentro da área segura", (_name, width, height) => {
    const layout = computeHookLayout({ ...realCase, width, height });
    expect(layout.estimatedHeight).toBeLessThanOrEqual(layout.safeHeight);
    expect(layout.logoHeight).toBeGreaterThanOrEqual(layout.logoMinHeight);
    expect(layout.titleFontSize).toBeGreaterThanOrEqual(24);
  });

  test("equilibra o título sem deixar palavra órfã", () => {
    const lines = balanceTitleLines(
      ["Ainda pagando aluguel e sonhando com a casa própria?"],
      3,
    );
    expect(lines.every((line) => line.trim().split(/\s+/).length > 1)).toBe(true);
    const lengths = lines.map((line) => line.length);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThan(12);
  });
});
