// Se um caso falhar, a mudança quebrou um fluxo já validado em produção — corrija o código, não o teste.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
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
import {
  isProductAdCreativeRequest,
} from "./image-composition.ts";
import { hasExplicitSceneDescription } from "./image-edit-instruction.ts";
import { isVehiclePhotoCarouselRequest } from "./vehicle-carousel.ts";
import { isVideoMotionRequest } from "./video-client-identity.ts";
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
