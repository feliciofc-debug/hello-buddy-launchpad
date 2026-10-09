import type { RenderContext, RenderSlide } from "./darkPremium.ts";
import { buildMarketingTemplateSlide } from "./marketing.ts";

export function buildGradientVibrantSlide(
  slide: RenderSlide,
  context: RenderContext,
) {
  return buildMarketingTemplateSlide("gradient-vibrant", slide, context);
}
