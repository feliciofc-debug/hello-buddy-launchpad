import type { RenderContext, RenderSlide } from "./darkPremium.ts";
import { buildMarketingTemplateSlide } from "./marketing.ts";

export function buildElegantSerifSlide(
  slide: RenderSlide,
  context: RenderContext,
) {
  return buildMarketingTemplateSlide("elegant-serif", slide, context);
}
