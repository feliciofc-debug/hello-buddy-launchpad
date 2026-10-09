import type { RenderContext, RenderSlide } from "./darkPremium.ts";
import { buildMarketingTemplateSlide } from "./marketing.ts";

export function buildNeonTechSlide(
  slide: RenderSlide,
  context: RenderContext,
) {
  return buildMarketingTemplateSlide("neon-tech", slide, context);
}
