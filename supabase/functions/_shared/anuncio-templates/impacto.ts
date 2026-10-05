import type { AnuncioData } from "./darkGold.ts";
import { buildPremiumAnuncio } from "./premiumLayout.ts";

export const buildImpactoAnuncio = (data: AnuncioData) =>
  buildPremiumAnuncio(data, "impacto");
