import {
  assert,
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  cleanVehicleTitle,
  composeVehicleAdVariant,
  generateVehicleAdCaptions,
  sanitizeVehicleAdLines,
  stripDuplicateVehicleFacts,
  vehicleAnuncioAiBriefing,
  vehicleDataLine,
} from "./anuncio-veiculo-captions.ts";
import { generateProductAdCaptions } from "./anuncio-produto-captions.ts";
import {
  generateVehicleAdCaptions as routeVehicleCaptions,
} from "./anuncio-social-flow.ts";
import {
  looksLikeVehicleKmPrecoReply,
  shouldUseVehicleSocialLibraryCaption,
  vehicleCaptionDataFromSources,
  vehicleCaptionMissingKmOrPreco,
  vehicleSocialCopyCancelRequest,
  vehicleSocialCopyPendingExpired,
} from "./vehicle-social-caption.ts";
import { mergeOwnerMediaRoute } from "./owner-media-route.ts";

const fullVehicle = {
  titulo: "JEEP RENEGADE Longitude T270 1.3 Flex",
  versao: "Longitude T270",
  ano: "2022",
  quilometragem: "45.000 km",
  cambio: "Automático",
  combustivel: "Flex",
  cor: "Prata",
  preco: "R$ 118.900",
  fipe: "R$ 122.000",
  opcionais: ["Ar-condicionado", "Multimídia", "Rodas de liga"],
  condicoes: ["Aceita troca", "Financia"],
  telefone: "5521999998888",
  cidade_loja: "Niterói",
};

const rav4Like = {
  titulo: "Toyota RAV4 / 15.000 km. PRETO.",
  quilometragem: "15.000 km",
  cor: "Preto",
  preco: "R$ 129.000,00",
  telefone: "5511999999999",
};

Deno.test("COPY-ANUNCIO — causa: veículo não deve usar só template sem IA", async () => {
  const source = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const block = source.slice(
    source.indexOf('if (niche === "veiculo")'),
    source.indexOf("const fallback = finish(generateProductAdCaptions"),
  );
  assertStringIncludes(block, "gerarTresOpcoesRedeSocial");
  assertStringIncludes(block, "composeVehicleAdVariant");
});

Deno.test("COPY-ANUNCIO — título limpa km/cor colados no titulo", () => {
  assertEquals(cleanVehicleTitle(rav4Like), "Toyota RAV4");
});

Deno.test("COPY-ANUNCIO — fallback A/B/C traz frase de venda e dados uma vez", () => {
  const captions = generateVehicleAdCaptions(rav4Like, 0);
  for (const [key, text] of Object.entries(captions)) {
    assert(text.length >= 80, `opção ${key} curta demais`);
    assert(!/\bgarantia\b/i.test(text));
    assert(!LONE_EMOJI.test(text));
    assertEquals(countOccurrences(text, "15.000 km"), 1);
    assertEquals(countOccurrences(text.toLowerCase(), "preto"), 1);
    assertStringIncludes(text, "R$ 129.000,00");
    assertStringIncludes(text, "📲 Chame no WhatsApp");
    assert(
      /(ideal|imagine|procura|oportunidade|visita|conhecer|volante|protagonista)/i
        .test(text),
      `sem frase de venda em ${key}`,
    );
  }
  assertNotEquals(captions.A, captions.B);
  assertNotEquals(captions.B, captions.C);
});

Deno.test("COPY-ANUNCIO — compose mescla IA e remove linha só emoji", () => {
  const raw = "🔥 SUV pronto para a estrada.\n📲\n🛣️ 15.000 km · 🎨 Preto\nMais uma linha.";
  const composed = composeVehicleAdVariant(raw, rav4Like, "A");
  assertEquals(sanitizeVehicleAdLines(composed).includes("\n📲\n"), false);
  assertEquals(countOccurrences(composed, "15.000 km"), 1);
  assertStringIncludes(composed, "Toyota RAV4");
});

Deno.test("COPY-ANUNCIO — briefing proíbe inventar e repetir bloco de dados", () => {
  const briefing = vehicleAnuncioAiBriefing(rav4Like);
  assertStringIncludes(briefing, "Não invente");
  assertStringIncludes(briefing, "15.000 km");
});

Deno.test("COPY-ANUNCIO — linha de dados compacta", () => {
  assertEquals(
    vehicleDataLine(rav4Like),
    "🛣️ 15.000 km · 🎨 Preto · 💰 R$ 129.000,00",
  );
});

Deno.test("COPY-VEICULO — opções A/B/C trazem km, preço e contato", () => {
  const captions = generateVehicleAdCaptions(fullVehicle, 0);
  for (const text of Object.values(captions)) {
    assertStringIncludes(text, "45.000 km");
    assertStringIncludes(text, "R$ 118.900");
    assertStringIncludes(text, "📲 Chame no WhatsApp: https://wa.me/5521999998888");
    assert(text.length <= 900);
    assert(!/\bgarantia\b/i.test(text));
    assert(!/\búnico dono\b/i.test(text));
  }
  assertStringIncludes(captions.A, "🚗 JEEP RENEGADE");
});

Deno.test("COPY-VEICULO — sem preço não cita valor de venda (FIPE pode aparecer)", () => {
  const captions = generateVehicleAdCaptions({
    titulo: "Fiat Argo",
    quilometragem: "30.000 km",
  }, 0);
  const joined = Object.values(captions).join("\n");
  assert(!joined.includes("💰"));
});

Deno.test("COPY-VEICULO — sem itens não inventa revisão/garantia/laudo", () => {
  const captions = generateVehicleAdCaptions({
    titulo: "Honda Civic",
    ano: "2020",
    cambio: "Manual",
  }, 0);
  const text = Object.values(captions).join(" ").toLowerCase();
  for (const term of ["garantia", "laudo", "único dono", "revisado", "baixa km"]) {
    assert(!text.includes(term));
  }
});

Deno.test("COPY-VEICULO — produto AMZ permanece idêntico ao gerador de produto", () => {
  const data = {
    titulo: "Interruptor Tramontina",
    itens: ["Bivolt automático", "Cor branca"],
    preco: "R$ 49,90",
    telefone: "5592999999999",
  };
  assertEquals(routeVehicleCaptions(data, 0, "produto"), generateProductAdCaptions(data));
});

Deno.test("COPY-VEICULO — gate km/preço", () => {
  const missing = vehicleCaptionMissingKmOrPreco(
    vehicleCaptionDataFromSources({
      nome: "Jeep Compass",
      descricao: "ano 2021 automático",
    }),
  );
  assertEquals(missing.includes("km"), true);
  assertEquals(missing.includes("preco"), true);
});

Deno.test("COPY-VEICULO-1.1 — tapete confirmado geral ignora palavra carro na descrição", () => {
  const router = {
    media_routes: mergeOwnerMediaRoute({}, "midia-tapete", {
      route: "geral",
      origin: "botao_dono",
      vision_description: "tapete para carro",
      confirmed: true,
    }),
  };
  assertEquals(
    shouldUseVehicleSocialLibraryCaption({
      mediaId: "midia-tapete",
      verticalRouter: router,
      verticalScope: "veiculo",
      fallbackContext: {
        nome: "Tapete automotivo",
        descricaoVisual: "tapete para carro em borracha",
        briefing: "",
      },
    }),
    false,
  );
});

Deno.test("COPY-VEICULO-1.1 — pendente expira em 30 minutos", () => {
  const old = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  assertEquals(vehicleSocialCopyPendingExpired(old), true);
  assertEquals(
    vehicleSocialCopyPendingExpired(new Date().toISOString()),
    false,
  );
});

Deno.test("COPY-VEICULO-1.1 — cancelar limpa intenção de km/preço", () => {
  assertEquals(vehicleSocialCopyCancelRequest("cancelar"), true);
  assertEquals(vehicleSocialCopyCancelRequest("deixa"), true);
  assertEquals(looksLikeVehicleKmPrecoReply("cancelar"), false);
});

Deno.test("COPY-VEICULO-1.2 — reconhece respostas só de preço (normalizado minúsculo)", () => {
  for (const sample of ["R$ 89.900", "89 mil", "preço 89.900"]) {
    assertEquals(looksLikeVehicleKmPrecoReply(sample), true);
  }
});

Deno.test("COPY-VEICULO-1.2 — reconhece respostas de km", () => {
  for (const sample of ["45.000 km", "45 mil km", "km 45000"]) {
    assertEquals(looksLikeVehicleKmPrecoReply(sample), true);
  }
});

Deno.test("COPY-VEICULO-1.2 — km + preço e outros assuntos", () => {
  assertEquals(looksLikeVehicleKmPrecoReply("45 mil km e R$ 118.900"), true);
  for (const sample of ["cancelar", "cria um vídeo do Renegade", "bom dia"]) {
    assertEquals(looksLikeVehicleKmPrecoReply(sample), false);
  }
});

const LONE_EMOJI = /^[\s📲📱🚗🛣️🎨💰📅⛽⚙️👉]+$/u;

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while (true) {
    const index = haystack.indexOf(needle, pos);
    if (index < 0) break;
    count += 1;
    pos = index + needle.length;
  }
  return count;
}

Deno.test("COPY-ANUNCIO — stripDuplicateVehicleFacts remove bloco repetido", () => {
  const stripped = stripDuplicateVehicleFacts(
    "Texto\n🛣️ 15.000 km · 🎨 Preto\nOutro parágrafo.",
    rav4Like,
  );
  assertEquals(stripped.includes("🛣️ 15.000 km"), false);
  assertStringIncludes(stripped, "Outro parágrafo");
});
