import type { AnuncioData } from "./darkGold.ts";
import { buildPremiumAnuncio } from "./premiumLayout.ts";

export const buildDestaqueAnuncio = (data: AnuncioData) =>
  buildPremiumAnuncio(data, "destaque");
