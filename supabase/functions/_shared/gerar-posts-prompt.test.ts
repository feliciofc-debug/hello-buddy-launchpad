import {
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildGerarPostsVehiclePrompt } from "./gerar-posts-vehicle-prompt.ts";
import { COPY_STYLE_PADRAO } from "./copy-style.ts";

const PRODUCT_SOURCE = "supabase/functions/gerar-posts/index.ts";

Deno.test("gerar-posts produto sem item_tipo mantém prompt clássico", async () => {
  const source = await Deno.readTextFile(PRODUCT_SOURCE);
  assertStringIncludes(source, "Gere 9 variações de posts");
  assertStringIncludes(source, "Produto: ${produto.nome}");
  assertStringIncludes(source, "${produto.preco ? `Preço: R$ ${produto.preco}` : ''}");
  assertStringIncludes(source, "if (item_tipo === 'veiculo')");
});

Deno.test("prompt veículo proíbe preço e links", () => {
  const prompt = buildGerarPostsVehiclePrompt({
    marca: "Land Rover",
    modelo: "Defender",
    versao: "110",
    ano_modelo: 2023,
    km: 20800,
    blindado: true,
    nivel_blindagem: "Carbon",
    nome_loja: "Royal 4x4",
  }, COPY_STYLE_PADRAO);
  assertStringIncludes(prompt, "NÃO inclua preço");
  assertStringIncludes(prompt, "sofisticada e discreta");
  assertStringIncludes(prompt, "emocional e envolvente");
  assertStringIncludes(prompt, "Royal 4x4");
});
