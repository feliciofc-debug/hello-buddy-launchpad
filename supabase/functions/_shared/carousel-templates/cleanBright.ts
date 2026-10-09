import type { RenderContext, RenderSlide } from "./darkPremium.ts";
import { buildMarketingTemplateSlide } from "./marketing.ts";

export function buildCleanBrightSlide(
  slide: RenderSlide,
  context: RenderContext,
) {
  return buildMarketingTemplateSlide("clean-bright", slide, context);
}
