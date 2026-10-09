// Se um caso falhar, a mudança quebrou um fluxo já validado em produção — corrija o código, não o teste.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  contentCreationCommandKind,
  isMetaAdsQuestionarioConsulta,
  isMetaAdsQuestionarioMixedContentRequest,
  isMetaAdsQuestionarioTrigger,
  metaAdsCommandText,
} from "./meta-ads-questionario.ts";
import {
  classifyOwnerMediaIntent,
  selectPublicationMediaId,
} from "./owner-media-intent.ts";
import { logoPlacementMode } from "./logo-placement-intent.ts";
import { isProductAdCreativeRequest } from "./image-composition.ts";
import { hasExplicitSceneDescription } from "./image-edit-instruction.ts";
import { isVehiclePhotoCarouselRequest } from "./vehicle-carousel.ts";
import { isVideoMotionRequest } from "./video-client-identity.ts";
import {
  AMZ_CAROUSEL_COLOR,
  carouselColorFallbackButtons,
  carouselColorListPayload,
  deliverCarouselColorSelector,
  detectExplicitCarouselColor,
  resolveCarouselColorPlan,
  safeCarouselThemeSummary,
} from "./carousel-colors.ts";
import { safeMetaDiagnosticPayload } from "./whatsapp-interactive-safe.ts";
import {
  carouselStyleFallbackButtons,
  carouselStyleListPayload,
  resolveCarouselStyleRequest,
} from "./carousel-styles.ts";
import {
  fipeInputFromConfirmedVehicle,
  vehicleFipeTurn,
} from "./fipe-routing.ts";
import {
  parseVerticalVisionResult,
  resolveVertical,
} from "./vertical-router.ts";

type GoldenRoute =
  | "carousel"
  | "meta_ads"
  | "meta_ads_report"
  | "meta_ads_or_content"
  | "image_edit"
  | "logo_top_left"
  | "logo_object"
  | "publication_approved_media"
  | "vehicle"
  | "general"
  | "fipe"
  | "video"
  | "unclassified";

type GoldenCase = {
  name: string;
  text: string;
  expected: GoldenRoute;
  tenantSegment?: string;
  vision?: "vehicle" | "general";
  approvedMediaId?: string;
};

function classifyGoldenRoute(testCase: GoldenCase): GoldenRoute {
  const { text } = testCase;
  if (isMetaAdsQuestionarioMixedContentRequest(text)) {
    return "meta_ads_or_content";
  }
  if (
    isMetaAdsQuestionarioConsulta(metaAdsCommandText(text)) &&
    /\b(?:campanha|anuncio|meta ads)\b/i.test(metaAdsCommandText(text))
  ) {
    return "meta_ads_report";
  }
  if (isMetaAdsQuestionarioTrigger(text)) return "meta_ads";

  const contentKind = contentCreationCommandKind(text);
  if (
    contentKind === "carousel" ||
    isVehiclePhotoCarouselRequest(text)
  ) return "carousel";

  const logoMode = logoPlacementMode(text);
  if (logoMode === "top-left") return "logo_top_left";
  if (logoMode === "object") return "logo_object";

  const ownerMediaIntent = classifyOwnerMediaIntent(text);
  if (
    ownerMediaIntent.action === "edit" &&
    hasExplicitSceneDescription(text)
  ) return "image_edit";
  if (ownerMediaIntent.action === "post") {
    const mediaId = selectPublicationMediaId({
      explicitId: testCase.approvedMediaId,
    });
    return mediaId ? "publication_approved_media" : "unclassified";
  }
  if (isVideoMotionRequest(text) || contentKind === "video") return "video";

  const vision = testCase.vision
    ? parseVerticalVisionResult(JSON.stringify({
      route: testCase.vision === "vehicle" ? "veiculo" : "geral",
      confidence: 0.99,
      reason: "fixture_golden",
    }))
    : null;
  const vertical = resolveVertical({
    text,
    tenantSegment: testCase.tenantSegment ?? "Marketing digital",
    vision,
  });
  if (vertical.explicitFipe) return "fipe";
  if (
    /\ban[uú]ncio\b/i.test(text) ||
    isProductAdCreativeRequest(text)
  ) {
    return vertical.route === "veiculo" ? "vehicle" : "general";
  }
  return "unclassified";
}

const REAL_OWNER_CAROUSEL_REQUEST =
  `Crie um carrossel para o Instagram da AMZ Ofertas, com a identidade visual do nosso site. Público: empresários e donos de pequenos negócios. Mensagem central: a AMZ Ofertas funciona como um time de marketing completo. Estrutura (6 slides): 1. Capa: Sua empresa precisa de marketing que vende. 2. Estrategista: planeja o crescimento. 3. Copywriter: escreve textos que convertem. 4. Gestor de tráfego: cria e gerencia anúncios e campanhas no Instagram. 5. Designer: transforma estratégia em conteúdo. 6. CTA: fale com a AMZ Ofertas.`;

const cases: GoldenCase[] = [
  {
    name: "briefing completo do carrossel da AMZ",
    text: REAL_OWNER_CAROUSEL_REQUEST,
    expected: "carousel",
  },
  {
    name: "carrossel com fotos",
    text: "faz um carrossel com essas fotos",
    expected: "carousel",
  },
  {
    name: "campanha paga explícita no Instagram",
    text:
      "crie uma campanha no Instagram para vender canecas, orçamento 20 reais por dia",
    expected: "meta_ads",
  },
  {
    name: "impulsionamento explícito",
    text: "impulsiona esse post",
    expected: "meta_ads",
  },
  {
    name: "consulta de gasto é relatório",
    text: "quanto gastei na campanha?",
    expected: "meta_ads_report",
  },
  {
    name: "troca de cenário é edição de imagem",
    text: "troca o cenário desta foto: mesa de madeira clara...",
    expected: "image_edit",
  },
  {
    name: "logo genérica fica no canto superior esquerdo",
    text: "coloca a logo da AMZ Ofertas nessa imagem",
    expected: "logo_top_left",
  },
  {
    name: "logo citando superfície vai no objeto",
    text: "coloca a logo na caneca",
    expected: "logo_object",
  },
  {
    name: "publicação usa imagem aprovada",
    text: "publica no feed do Facebook e Instagram",
    approvedMediaId: "midia-aprovada-001",
    expected: "publication_approved_media",
  },
  {
    name: "anúncio de carro em revenda usa vertical veículo",
    text: "anúncio deste carro",
    tenantSegment: "Revenda de seminovos",
    vision: "vehicle",
    expected: "vehicle",
  },
  {
    name: "anúncio de caneca em consórcio usa vertical geral",
    text: "anúncio",
    tenantSegment: "Consórcio",
    vision: "general",
    expected: "general",
  },
  {
    name: "consulta FIPE",
    text: "qual a FIPE do Corolla XEi 2022?",
    tenantSegment: "Revenda de seminovos",
    expected: "fipe",
  },
  {
    name: "vídeo com foto",
    text: "faz um vídeo com essa foto",
    expected: "video",
  },
  {
    name: "conteúdo e mídia paga no mesmo comando pede escolha",
    text: "crie um carrossel e impulsione",
    expected: "meta_ads_or_content",
  },
];

Deno.test("golden de roteamento preserva fluxos validados em produção", async (t) => {
  for (const testCase of cases) {
    await t.step(testCase.name, () => {
      assertEquals(
        classifyGoldenRoute(testCase),
        testCase.expected,
        `${testCase.name}: rota esperada ${testCase.expected}`,
      );
    });
  }
});

Deno.test("golden do seletor de cor preserva marca, Unicode e fallback", async (t) => {
  await t.step("identidade visual usa laranja da AMZ sem seletor", () => {
    const plan = resolveCarouselColorPlan({
      request: REAL_OWNER_CAROUSEL_REQUEST,
      brandColors: ["#F36812"],
      brandFallback: AMZ_CAROUSEL_COLOR,
    });
    assertEquals(plan.shouldAsk, false);
    assertEquals(plan.source, "tenant_brand");
    assertEquals(plan.color?.primaryColor, "#F36812");
    assertEquals(
      detectExplicitCarouselColor("faça o carrossel em azul")?.slug,
      "azul",
    );
  });

  await t.step("tema com emoji no limite não parte surrogate", () => {
    const theme = `${"a".repeat(59)}🚀 texto que não deve entrar\n**markdown**`;
    const summary = safeCarouselThemeSummary(theme);
    const payload = carouselColorListPayload(theme);
    assertEquals(Array.from(summary).length, 60);
    assert(summary.endsWith("🚀"));
    assert(!summary.includes("\uFFFD"));
    assert(!/[\n*_`~]/.test(payload.body));
    assert(payload.body.includes(summary));
  });

  await t.step("falha da lista envia três reply buttons", async () => {
    let buttonsSent = 0;
    assertEquals(
      carouselColorFallbackButtons().buttons.map((button) => button.title),
      ["Cor da marca", "Azul", "Roxo"],
    );
    const delivery = await deliverCarouselColorSelector({
      sendList: () => Promise.reject(new Error("Meta #131000")),
      sendButtons: () => {
        buttonsSent += 1;
        return Promise.resolve();
      },
      notifyAutomatic: () => Promise.resolve(),
    });
    assertEquals(delivery, "buttons");
    assertEquals(buttonsSent, 1);
  });

  await t.step(
    "falha de lista e botões segue automaticamente sem erro técnico",
    async () => {
      let notice = "";
      const delivery = await deliverCarouselColorSelector({
        sendList: () => Promise.reject(new Error("Meta #131000")),
        sendButtons: () => Promise.reject(new Error("Meta #131000")),
        notifyAutomatic: () => {
          notice =
            "Não consegui abrir as opções de cor. Vou usar a cor da marca e seguir.";
          return Promise.resolve();
        },
      });
      assertEquals(delivery, "automatic");
      assert(!/131000|seletor_cor_falhou|[{"]/.test(notice));
      assert(notice.includes("Vou usar a cor da marca"));
    },
  );

  await t.step("diagnóstico mascara telefone e token", () => {
    const safe = safeMetaDiagnosticPayload({
      to: "5521999991234",
      access_token: "segredo",
      interactive: { body: { text: "Escolha" } },
    }) as Record<string, unknown>;
    assertEquals(safe.to, "*********1234");
    assertEquals(safe.access_token, "[REDACTED]");
  });
});

Deno.test("golden de estilo e fundo do carrossel", async (t) => {
  const styleCases = [
    {
      text: "carrossel com fundo branco",
      template: "clean-bright",
      backgroundColor: "#FFFFFF",
    },
    {
      text: "carrossel fundo laranja",
      template: "clean-bright",
      backgroundColor: "#F36812",
    },
    {
      text: "carrossel com a identidade visual do nosso site",
      template: "clean-bright",
      backgroundColor: null,
    },
  ] as const;
  for (const testCase of styleCases) {
    await t.step(testCase.text, () => {
      const plan = resolveCarouselStyleRequest({ request: testCase.text });
      assertEquals(plan.template, testCase.template);
      assertEquals(plan.backgroundColor, testCase.backgroundColor);
      assertEquals(plan.needsSelector, false);
    });
  }

  await t.step("pedido sem estilo envia uma lista com os cinco estilos", () => {
    const plan = resolveCarouselStyleRequest({
      request: "crie um carrossel sobre atendimento",
    });
    assertEquals(plan.needsSelector, true);
    assertEquals(plan.template, null);
    assertEquals(carouselStyleListPayload().rows.length, 5);
    assertEquals(
      carouselStyleFallbackButtons().buttons.map((button) => button.title),
      ["Escuro premium", "Claro clean", "Colorido vibrante"],
    );
  });

  await t.step(
    "identidade visual usa marca sem seletor separado de cor",
    () => {
      const color = resolveCarouselColorPlan({
        request: "carrossel com a identidade visual do nosso site",
        brandColors: ["#F36812"],
      });
      assertEquals(color.shouldAsk, false);
      assertEquals(color.color?.primaryColor, "#F36812");
    },
  );
});

Deno.test("golden FIPE preserva o anúncio de veículo pendente", async (t) => {
  const confirmed = {
    confirmed: true,
    confirmed_title: "GWM Tank 300",
    identification: { marca: "GWM", modelo: "Tank 300" },
    data: { titulo: "GWM Tank 300" },
  };
  await t.step("foto confirmada + pedido FIPE pede somente o ano", () => {
    const text = "qual a fipe desse carro?";
    const input = fipeInputFromConfirmedVehicle(text, confirmed);
    assertEquals(vehicleFipeTurn(text, input), "fipe_ask_year");
    assertEquals(input.marca, "GWM");
    assertEquals(input.modelo, "Tank 300");
  });
  await t.step("ano seguinte pertence à FIPE e não ao anúncio", () => {
    const input = fipeInputFromConfirmedVehicle("2025", confirmed);
    assertEquals(vehicleFipeTurn("2025", input, true), "fipe_pending");
  });
  await t.step("pedido completo consulta FIPE diretamente", () => {
    const text = "qual a FIPE do GWM Tank 300 2025?";
    const input = fipeInputFromConfirmedVehicle(text, null);
    assertEquals(vehicleFipeTurn(text, input), "fipe_lookup");
    assertEquals(input.ano_modelo, "2025");
  });
});
