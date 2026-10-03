import { describe, expect, test } from "bun:test";
import { stripDuplicateHighlight } from "./hook-text";

describe("hook highlight", () => {
  test("remove do título o destaque duplicado sem considerar acento ou pontuação", () => {
    expect(stripDuplicateHighlight(
      ["Sem tempo para cuidar do marketing?"],
      "MARKETING!",
    )).toEqual(["Sem tempo para cuidar do"]);
  });

  test("mantém título que não termina com o destaque", () => {
    const lines = ["Venda mais todos os dias"];
    expect(stripDuplicateHighlight(lines, "Agora")).toEqual(lines);
  });
});
